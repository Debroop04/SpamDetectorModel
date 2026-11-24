package app.callshield.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.callshield.CallShieldApp
import app.callshield.data.CallDetail
import app.callshield.data.PhoneNumbers
import app.callshield.ui.Navigator
import app.callshield.ui.Route
import app.callshield.ui.Tone
import app.callshield.ui.components.AppButton
import app.callshield.ui.components.AppCard
import app.callshield.ui.components.Badge
import app.callshield.ui.components.ButtonKind
import app.callshield.ui.components.Divider
import app.callshield.ui.components.EmptyState
import app.callshield.ui.components.IconBubble
import app.callshield.ui.components.KeyValue
import app.callshield.ui.components.ListRow
import app.callshield.ui.components.Placeholder
import app.callshield.ui.components.RiskMeter
import app.callshield.ui.components.Segmented
import app.callshield.ui.components.SectionTitle
import app.callshield.ui.components.Toasts
import app.callshield.ui.components.TopBar
import app.callshield.ui.formatDateTime
import app.callshield.ui.formatTime
import app.callshield.ui.percent
import app.callshield.ui.reportStatusLabel
import app.callshield.ui.reportStatusTone
import app.callshield.ui.statusLabel
import app.callshield.ui.theme.AppTheme
import app.callshield.ui.theme.Icons
import app.callshield.ui.timeAgo
import app.callshield.ui.verdictLabel
import app.callshield.ui.verdictTone
import kotlinx.coroutines.launch
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonPrimitive

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CallsScreen(app: CallShieldApp, nav: Navigator) {
    val store = app.store
    var filter by rememberSaveable { mutableStateOf("all") }
    var refreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { store.refreshCalls() }

    val calls = store.calls
    val visible = calls?.filter { filter == "all" || it.verdict == filter }

    Column(Modifier.fillMaxSize()) {
        TopBar("Calls")
        Segmented(
            listOf("all" to "All", "spam" to "Scam", "suspicious" to "Suspicious", "safe" to "Safe"),
            filter,
            { filter = it },
            Modifier.padding(horizontal = 20.dp).fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = {
                scope.launch {
                    refreshing = true
                    store.refreshCalls().join()
                    refreshing = false
                }
            },
            modifier = Modifier.weight(1f),
        ) {
            when {
                visible == null -> Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    repeat(5) { Placeholder(64.dp) }
                }
                visible.isEmpty() -> EmptyState(Icons.PhoneIncoming, if (filter == "all") "No calls yet" else "No calls match")
                else -> LazyColumn(contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 20.dp)) {
                    item {
                        AppCard(Modifier.fillMaxWidth(), padding = 0.dp) {
                            visible.forEachIndexed { index, call ->
                                if (index > 0) Divider()
                                ListRow(
                                    title = call.caller_name ?: PhoneNumbers.display(call.caller_number),
                                    detail = (call.category ?: statusLabel(call.status)) + " · " + timeAgo(call.started_at),
                                    leading = { IconBubble(if (call.channel == "browser") Icons.Globe else Icons.PhoneIncoming, verdictTone(call.verdict), 38.dp) },
                                    trailing = { Badge(verdictLabel(call.verdict), verdictTone(call.verdict)) },
                                    onClick = { nav.push(Route.CallDetail(call.id)) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CallDetailScreen(app: CallShieldApp, id: Int, nav: Navigator) {
    val c = AppTheme.colors
    val scope = rememberCoroutineScope()
    var call by remember { mutableStateOf<CallDetail?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf<String?>(null) }

    suspend fun load() {
        runCatching { app.api.call(id) }.onSuccess { call = it; error = null }.onFailure { error = it.message }
    }
    LaunchedEffect(id) { load() }
    LaunchedEffect(Unit) { app.store.changes.collect { if (it == "calls" || it == "reports") load() } }

    fun act(key: String, block: suspend () -> Unit, done: String) {
        scope.launch {
            busy = key
            runCatching { block() }
                .onSuccess { Toasts.show(done); load(); app.store.refreshCalls(); app.store.refreshReports() }
                .onFailure { Toasts.show(it.message ?: "Something went wrong", Tone.Danger) }
            busy = null
        }
    }

    Column(Modifier.fillMaxSize()) {
        TopBar(call?.let { it.caller_name ?: PhoneNumbers.display(it.caller_number) } ?: "Call", onBack = { nav.pop() })
        val current = call
        if (current == null) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (error != null) EmptyState(Icons.AlertTriangle, error!!) else {
                    Placeholder(110.dp); Placeholder(180.dp); Placeholder(220.dp)
                }
            }
            return@Column
        }
        val signals = current.signals
        fun signal(key: String) = signals[key]?.jsonPrimitive?.doubleOrNull
        val canAct = current.caller_number.startsWith("+")

        LazyColumn(contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item {
                AppCard(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconBubble(Icons.PhoneIncoming, verdictTone(current.verdict), 48.dp)
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text(PhoneNumbers.display(current.caller_number), style = MaterialTheme.typography.titleMedium, color = c.ink)
                            Text(formatDateTime(current.started_at), style = MaterialTheme.typography.bodySmall, color = c.ink3)
                        }
                        Badge(verdictLabel(current.verdict), verdictTone(current.verdict))
                    }
                    Spacer(Modifier.height(8.dp))
                    KeyValue("Outcome", statusLabel(current.status))
                    KeyValue("Language", if (current.language == "hi") "Hindi" else "English")
                    KeyValue("Reports", "${current.number_reports} from the community")
                    current.rule?.let { KeyValue("Your list", if (it == "allow") "Trusted" else "Blocked") }
                }
            }
            item {
                AppCard(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(current.category ?: "No scam pattern", style = MaterialTheme.typography.titleSmall, color = c.ink, modifier = Modifier.weight(1f))
                        Text(percent(current.risk_score), style = MaterialTheme.typography.titleLarge, color = c.ink)
                    }
                    Spacer(Modifier.height(14.dp))
                    SignalRow("Spam model", signal("model_score"))
                    SignalRow("Scam phrases", signal("rule_score"))
                    SignalRow("Number history", signal("reputation_score"))
                    if (current.reasons.isNotEmpty()) {
                        Spacer(Modifier.height(10.dp))
                        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(c.subtle).padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            current.reasons.forEach { Text("• $it", style = MaterialTheme.typography.bodyMedium, color = c.ink2) }
                        }
                    }
                }
            }
            current.report?.let { report ->
                item {
                    AppCard(Modifier.fillMaxWidth(), onClick = { nav.push(Route.ReportDetail(report.id)) }) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconBubble(Icons.FileText, reportStatusTone(report.status), 40.dp)
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(report.reference, style = MaterialTheme.typography.titleSmall, color = c.ink)
                                Text(report.station_name ?: "Finding the nearest station", style = MaterialTheme.typography.bodySmall, color = c.ink3, maxLines = 1)
                            }
                            Badge(reportStatusLabel(report.status), reportStatusTone(report.status))
                        }
                    }
                }
            }
            if (canAct) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (current.report == null) {
                            AppButton("Report to police", {
                                act("report", { app.api.reportCall(current.id) }, "Report created and sent")
                            }, Modifier.fillMaxWidth(), kind = ButtonKind.Danger, icon = Icons.Siren, loading = busy == "report")
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            if (current.rule != "block") {
                                AppButton("Block", {
                                    act("block", { app.api.setRule(current.caller_number, "block"); app.cache.addRule(current.caller_number, "block") }, "Number blocked")
                                }, Modifier.weight(1f), kind = ButtonKind.Secondary, icon = Icons.Ban, loading = busy == "block")
                            }
                            if (current.rule != "allow") {
                                AppButton("Trust", {
                                    act("allow", { app.api.setRule(current.caller_number, "allow"); app.cache.addRule(current.caller_number, "allow") }, "Number trusted")
                                }, Modifier.weight(1f), kind = ButtonKind.Secondary, icon = Icons.ShieldCheck, loading = busy == "allow")
                            }
                        }
                    }
                }
            }
            if (current.turns.isNotEmpty()) {
                item { SectionTitle("Transcript") }
                items(current.turns) { turn ->
                    val caller = turn.speaker == "caller"
                    Row(Modifier.fillMaxWidth()) {
                        IconBubble(if (caller) Icons.User else Icons.Bot, if (caller) Tone.Neutral else Tone.Accent, 32.dp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(if (caller) "Caller" else "Assistant", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold), color = c.ink)
                                Spacer(Modifier.width(8.dp))
                                Text(formatTime(turn.created_at), style = MaterialTheme.typography.labelSmall, color = c.ink3)
                            }
                            Spacer(Modifier.height(2.dp))
                            Text(turn.text, style = MaterialTheme.typography.bodyMedium, color = if (caller) c.ink else c.ink2)
                            if (turn.text_en != null && turn.text_en != turn.text) {
                                Text(turn.text_en, style = MaterialTheme.typography.bodySmall, color = c.ink3, modifier = Modifier.padding(top = 4.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SignalRow(label: String, value: Double?) {
    val c = AppTheme.colors
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = c.ink3, modifier = Modifier.width(110.dp))
        if (value == null) {
            Text("Not used", style = MaterialTheme.typography.bodySmall, color = c.ink3)
        } else {
            RiskMeter(value, Modifier.weight(1f))
        }
    }
}
