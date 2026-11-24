package app.callshield.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.callshield.CallShieldApp
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Request
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources

/**
 * Screen data shared across the app. Lists keep their last value while refreshing,
 * so going back to a screen never flashes empty.
 */
class AppStore(private val app: CallShieldApp) {
    var user by mutableStateOf<User?>(null)
    var stats by mutableStateOf<Stats?>(null)
    var calls by mutableStateOf<List<CallItem>?>(null)
    var reports by mutableStateOf<List<Report>?>(null)
    var liveCalls by mutableStateOf<List<CallItem>>(emptyList())
    var liveTurns by mutableStateOf<Map<Int, List<LiveTurn>>>(emptyMap())
    var sync by mutableStateOf<SyncData?>(null)
    var latestApk by mutableStateOf<ApkInfo?>(null)
    var liveConnected by mutableStateOf(false)
    var theme by mutableStateOf(app.session.theme)

    private val _changes = MutableSharedFlow<String>(extraBufferCapacity = 16)
    /** Emits "calls" or "reports" when the server pushes a change. */
    val changes: SharedFlow<String> = _changes

    private val api get() = app.api
    private var events: EventSource? = null
    private var refreshJob: Job? = null

    fun refreshAll() {
        refreshJob?.cancel()
        refreshJob = app.scope.launch {
            launch { runCatching { api.me() }.onSuccess { user = it; app.session.userName = it.name } }
            launch { runCatching { api.stats() }.onSuccess { stats = it } }
            launch { runCatching { api.calls() }.onSuccess { calls = it.items } }
            launch { runCatching { api.reports() }.onSuccess { reports = it } }
            launch { runCatching { api.liveCalls() }.onSuccess { liveCalls = it } }
            launch { runCatching { api.sync() }.onSuccess { sync = it; app.cache.update(it) } }
            launch { runCatching { api.appInfo() }.onSuccess { latestApk = it.latest } }
        }
    }

    fun refreshCalls() = app.scope.launch {
        runCatching { api.calls() }.onSuccess { calls = it.items }
        runCatching { api.stats() }.onSuccess { stats = it }
    }

    fun refreshReports() = app.scope.launch {
        runCatching { api.reports() }.onSuccess { reports = it }
        runCatching { api.stats() }.onSuccess { stats = it }
    }

    fun refreshSync() = app.scope.launch {
        runCatching { api.sync() }.onSuccess { sync = it; app.cache.update(it) }
    }

    fun clear() {
        stopLive()
        user = null; stats = null; calls = null; reports = null
        liveCalls = emptyList(); liveTurns = emptyMap(); sync = null
    }

    // ---------- Live updates while the app is open ----------

    fun startLive() {
        if (events != null || !app.session.isSignedIn) return
        val request = runCatching { Request.Builder().url(api.authedUrl("/api/events")).build() }.getOrNull() ?: return
        val client = api.http.newBuilder().readTimeout(0, java.util.concurrent.TimeUnit.MILLISECONDS).build()
        events = EventSources.createFactory(client).newEventSource(request, object : EventSourceListener() {
            override fun onOpen(eventSource: EventSource, response: Response) {
                liveConnected = true
            }

            override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
                handle(data)
            }

            override fun onClosed(eventSource: EventSource) = retry()
            override fun onFailure(eventSource: EventSource, t: Throwable?, response: Response?) = retry()
        })
    }

    private fun retry() {
        liveConnected = false
        events = null
        app.scope.launch {
            kotlinx.coroutines.delay(4000)
            if (app.session.isSignedIn && foreground) startLive()
        }
    }

    var foreground = false

    fun stopLive() {
        events?.cancel()
        events = null
        liveConnected = false
    }

    private fun handle(raw: String) {
        val message = runCatching { json.parseToJsonElement(raw).jsonObject }.getOrNull() ?: return
        val event = message["event"]?.jsonPrimitive?.content ?: return
        val data = message["data"] ?: return
        when (event) {
            "call.started", "call.updated", "call.ended" -> {
                val call = runCatching { json.decodeFromJsonElement(CallItem.serializer(), data) }.getOrNull() ?: return
                val active = call.status == "screening" || call.status == "forwarding"
                liveCalls = (if (active && event != "call.ended") listOf(call) else emptyList()) + liveCalls.filter { it.id != call.id }
                refreshCalls()
                _changes.tryEmit("calls")
            }
            "call.turn" -> {
                val turn = runCatching { json.decodeFromJsonElement(LiveTurn.serializer(), data) }.getOrNull() ?: return
                liveTurns = liveTurns + (turn.call_id to (liveTurns[turn.call_id].orEmpty() + turn))
                _changes.tryEmit("calls")
            }
            "report.created", "report.updated" -> {
                refreshReports()
                _changes.tryEmit("reports")
            }
        }
    }
}
