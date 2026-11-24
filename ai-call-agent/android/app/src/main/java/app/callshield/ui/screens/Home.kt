package app.callshield.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import app.callshield.BuildConfig
import app.callshield.CallShieldApp
import app.callshield.data.CallItem
import app.callshield.data.PhoneNumbers
import app.callshield.screening.LoggedCall
import app.callshield.ui.Navigator
import app.callshield.ui.Route
import app.callshield.ui.Tone
import app.callshield.ui.components.AppButton
import app.callshield.ui.components.AppCard
import app.callshield.ui.components.Badge
import app.callshield.ui.components.ButtonKind
import app.callshield.ui.components.Divider
import app.callshield.ui.components.IconBubble
import app.callshield.ui.components.ListRow
import app.callshield.ui.components.Placeholder
import app.callshield.ui.components.RiskMeter
import app.callshield.ui.components.SectionTitle
import app.callshield.ui.components.StatTile
import app.callshield.ui.components.Toasts
import app.callshield.ui.components.soft
import app.callshield.ui.components.solid
import app.callshield.ui.statusLabel
import app.callshield.ui.theme.AppTheme
import app.callshield.ui.theme.Icons
import app.callshield.ui.timeAgo
import app.callshield.ui.verdictLabel
import app.callshield.ui.verdictTone
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(app: CallShieldApp, nav: Navigator) {
    val c = AppTheme.colors
    val context = LocalContext.current
    val store = app.store
    val log by app.log.entries.collectAsState()
    var setupTick by remember { mutableIntStateOf(0) }
    LifecycleResumeEffect(Unit) {
        setupTick++
        onPauseOrDispose { }
    }
    val setup = remember(setupTick) { SetupStatus.read(context) }
    val protectedNow = setup.complete && app.session.forwardingDone
    var refreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val today = LocalDate.now()
    val todays = log.filter { java.time.Instant.ofEpochMilli(it.at).atZone(ZoneId.systemDefault()).toLocalDate() == today }

    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = {
            scope.launch {
                refreshing = true
                store.refreshAll()
                kotlinx.coroutines.delay(700)
                refreshing = false
            }
        },
        modifier = Modifier.fillMaxSize(),
    ) {
        LazyColumn(
            Modifier.fillMaxSize().statusBarsPadding(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item {
                Row(Modifier.fillMaxWidth().padding(bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Hello, ${(store.user?.name ?: app.session.userName ?: "there").substringBefore(' ')}",
                        style = MaterialTheme.typography.headlineMedium,
                        color = c.ink,
                        modifier = Modifier.weight(1f),
                    )
                    Box(Modifier.size(10.dp).clip(CircleShape).background(if (store.liveConnected) c.safe else c.lineStrong))
                }
            }

            item {
                AppCard(Modifier.fillMaxWidth(), onClick = { nav.push(Route.Setup) }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier.size(52.dp).clip(RoundedCornerShape(16.dp)).background(if (protectedNow) c.safeSoft else c.warnSoft),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(if (protectedNow) Icons.ShieldCheck else Icons.ShieldAlert, null, Modifier.size(26.dp), tint = if (protectedNow) c.safe else c.warn)
                        }
                        Spacer(Modifier.width(14.dp))
                        Text(
                            if (protectedNow) "Protection is on" else "Finish setting up",
                            style = MaterialTheme.typography.titleMedium,
                            color = c.ink,
                            modifier = Modifier.weight(1f),
                        )
                        Icon(Icons.ChevronRight, null, Modifier.size(20.dp), tint = c.ink3)
                    }
                    Spacer(Modifier.height(16.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        MiniCount("Sent to AI", todays.count { it.rejected && it.reason.contains("AI") }, Tone.Accent, Modifier.weight(1f))
                        MiniCount("Blocked", todays.count { it.rejected && !it.reason.contains("AI") }, Tone.Danger, Modifier.weight(1f))
                        MiniCount("Rang you", todays.count { !it.rejected }, Tone.Safe, Modifier.weight(1f))
                    }
                }
            }

            store.latestApk?.takeIf { it.versionCode > BuildConfig.VERSION_CODE }?.let { apk ->
                item {
                    AppCard(Modifier.fillMaxWidth(), onClick = {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(app.api.url(apk.url))))
                    }) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconBubble(Icons.Download, Tone.Accent)
                            Spacer(Modifier.width(12.dp))
                            Text("Update to version ${apk.versionName}", style = MaterialTheme.typography.titleSmall, color = c.ink, modifier = Modifier.weight(1f))
                            Icon(Icons.ChevronRight, null, Modifier.size(20.dp), tint = c.ink3)
                        }
                    }
                }
            }

            store.liveCalls.firstOrNull()?.let { live ->
                item { LiveCallCard(app, live) { nav.push(Route.CallDetail(live.id)) } }
            }

            item {
                val s = store.stats
                if (s == null) {
                    Placeholder(196.dp)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            StatTile("Calls screened", s.screened.toString(), Icons.PhoneIncoming, Modifier.weight(1f))
                            StatTile("Scams blocked", s.blocked.toString(), Icons.Shield, Modifier.weight(1f))
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            StatTile("Reports sent", s.reports_sent.toString(), Icons.FileText, Modifier.weight(1f))
                            StatTile("Police replied", s.reports_acknowledged.toString(), Icons.CheckCircle, Modifier.weight(1f))
                        }
                    }
                }
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    AppButton("Check number", { nav.push(Route.Lookup) }, Modifier.weight(1f), kind = ButtonKind.Secondary, icon = Icons.Search)
                    AppButton("Report", { nav.tab(Route.NewReport()) }, Modifier.weight(1f), icon = Icons.Siren)
                }
            }

            item { SectionTitle("On this phone") }
            item {
                AppCard(Modifier.fillMaxWidth(), padding = 0.dp) {
                    if (log.isEmpty()) {
                        Text(
                            "Calls screened on this phone appear here.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = c.ink3,
                            modifier = Modifier.padding(18.dp),
                        )
                    } else {
                        log.take(6).forEachIndexed { index, entry ->
                            if (index > 0) Divider()
                            PhoneLogRow(entry) {
                                if (entry.number.isNotBlank()) nav.tab(Route.NewReport(entry.number))
                            }
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(8.dp)) }
        }
    }
}

@Composable
private fun MiniCount(label: String, count: Int, tone: Tone, modifier: Modifier = Modifier) {
    val c = AppTheme.colors
    Column(modifier.clip(RoundedCornerShape(12.dp)).background(c.soft(tone)).padding(horizontal = 12.dp, vertical = 10.dp)) {
        Text(count.toString(), style = MaterialTheme.typography.titleLarge, color = c.ink)
        Text(label, style = MaterialTheme.typography.labelSmall, color = c.ink2, maxLines = 1)
    }
}

@Composable
private fun PhoneLogRow(entry: LoggedCall, onClick: () -> Unit) {
    val c = AppTheme.colors
    val tone = when {
        !entry.rejected -> Tone.Safe
        entry.reason.contains("AI") -> Tone.Accent
        else -> Tone.Danger
    }
    ListRow(
        title = PhoneNumbers.display(entry.number.ifBlank { null }),
        detail = (entry.category ?: entry.reason) + " · " + timeAgo(entry.at),
        leading = { IconBubble(if (entry.rejected) Icons.Ban else Icons.Phone, tone, 36.dp) },
        trailing = {
            Text(
                when (tone) {
                    Tone.Safe -> "Rang"
                    Tone.Accent -> "To AI"
                    else -> "Blocked"
                },
                style = MaterialTheme.typography.labelMedium,
                color = c.solid(tone),
            )
        },
        onClick = onClick,
    )
}

@Composable
private fun LiveCallCard(app: CallShieldApp, call: CallItem, onOpen: () -> Unit) {
    val c = AppTheme.colors
    val scope = rememberCoroutineScope()
    val lastLine = app.store.liveTurns[call.id]?.lastOrNull()
    var busy by remember { mutableStateOf(false) }
    AppCard(Modifier.fillMaxWidth(), onClick = onOpen) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box {
                IconBubble(Icons.PhoneIncoming, Tone.Accent, 44.dp)
                Box(Modifier.align(Alignment.TopEnd).size(11.dp).clip(CircleShape).background(c.surface).padding(2.dp)) {
                    Box(Modifier.fillMaxSize().clip(CircleShape).background(c.danger))
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(call.caller_name ?: PhoneNumbers.display(call.caller_number), style = MaterialTheme.typography.titleSmall, color = c.ink, maxLines = 1)
                Text(statusLabel(call.status), style = MaterialTheme.typography.bodySmall, color = c.ink3)
            }
            Badge(verdictLabel(call.verdict), verdictTone(call.verdict))
        }
        if (lastLine != null) {
            Spacer(Modifier.height(12.dp))
            Text(
                "“${lastLine.text_en ?: lastLine.text}”",
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                color = c.ink2,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.height(12.dp))
        RiskMeter(call.risk_score)
        if (call.status == "screening") {
            Spacer(Modifier.height(12.dp))
            AppButton("Block and report", {
                scope.launch {
                    busy = true
                    runCatching { app.api.blockLiveCall(call.id) }
                        .onSuccess { Toasts.show("Call ended and reported", Tone.Danger) }
                        .onFailure { Toasts.show(it.message ?: "Could not block", Tone.Danger) }
                    busy = false
                }
            }, Modifier.fillMaxWidth(), kind = ButtonKind.Danger, icon = Icons.Ban, loading = busy)
        }
    }
}
