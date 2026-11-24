package app.callshield.ui.screens

import android.Manifest
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.callshield.CallShieldApp
import app.callshield.data.Locator
import app.callshield.data.ManualReportResult
import app.callshield.data.PhoneNumbers
import app.callshield.data.Report
import app.callshield.ui.FRAUD_CATEGORIES
import app.callshield.ui.Navigator
import app.callshield.ui.Route
import app.callshield.ui.Tone
import app.callshield.ui.components.AppButton
import app.callshield.ui.components.AppCard
import app.callshield.ui.components.AppTextField
import app.callshield.ui.components.Badge
import app.callshield.ui.components.ButtonKind
import app.callshield.ui.components.Divider
import app.callshield.ui.components.EmptyState
import app.callshield.ui.components.IconBubble
import app.callshield.ui.components.KeyValue
import app.callshield.ui.components.ListRow
import app.callshield.ui.components.Notice
import app.callshield.ui.components.Placeholder
import app.callshield.ui.components.SwitchRow
import app.callshield.ui.components.Toasts
import app.callshield.ui.components.TopBar
import app.callshield.ui.formatDateTime
import app.callshield.ui.percent
import app.callshield.ui.reportStatusLabel
import app.callshield.ui.reportStatusTone
import app.callshield.ui.theme.AppTheme
import app.callshield.ui.theme.Icons
import app.callshield.ui.timeAgo
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportsScreen(app: CallShieldApp, nav: Navigator) {
    val store = app.store
    var refreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { store.refreshReports() }
    val reports = store.reports

    Column(Modifier.fillMaxSize()) {
        TopBar("Police reports")
        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = {
                scope.launch {
                    refreshing = true
                    store.refreshReports().join()
                    refreshing = false
                }
            },
            modifier = Modifier.weight(1f),
        ) {
            when {
                reports == null -> Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { repeat(4) { Placeholder(64.dp) } }
                reports.isEmpty() -> EmptyState(Icons.FileText, "No reports yet") {
                    AppButton("Report a number", { nav.tab(Route.NewReport()) }, kind = ButtonKind.Secondary, icon = Icons.Siren)
                }
                else -> LazyColumn(contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 20.dp)) {
                    item {
                        AppCard(Modifier.fillMaxWidth(), padding = 0.dp) {
                            reports.forEachIndexed { index, report ->
                                if (index > 0) Divider()
                                ListRow(
                                    title = PhoneNumbers.display(report.caller_number),
                                    detail = (report.station_name ?: report.category) + " · " + timeAgo(report.created_at),
                                    leading = { IconBubble(Icons.FileText, reportStatusTone(report.status), 38.dp) },
                                    trailing = { Badge(reportStatusLabel(report.status), reportStatusTone(report.status)) },
                                    onClick = { nav.push(Route.ReportDetail(report.id)) },
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
private fun TimelineStep(icon: ImageVector, title: String, detail: String?, done: Boolean, active: Boolean, last: Boolean) {
    val c = AppTheme.colors
    Row(Modifier.fillMaxWidth()) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                Modifier
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(if (done) c.safe else if (active) c.accentSoft else c.surface)
                    .border(1.dp, if (done) c.safe else if (active) c.accent else c.line, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, null, Modifier.size(16.dp), tint = if (done) c.onAccent else if (active) c.accent else c.ink3)
            }
            if (!last) Box(Modifier.width(2.dp).height(30.dp).background(if (done) c.safe else c.line))
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.padding(top = 6.dp)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, color = if (done || active) c.ink else c.ink3)
            if (detail != null) Text(detail, style = MaterialTheme.typography.bodySmall, color = c.ink3)
        }
    }
}

@Composable
fun ReportDetailScreen(app: CallShieldApp, id: Int, nav: Navigator) {
    val c = AppTheme.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var report by remember { mutableStateOf<Report?>(null) }
    var busy by remember { mutableStateOf(false) }

    suspend fun load() = runCatching { app.api.report(id) }.onSuccess { report = it }
    LaunchedEffect(id) { load() }
    LaunchedEffect(Unit) { app.store.changes.collect { if (it == "reports") load() } }

    fun open(url: String) = runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }

    Column(Modifier.fillMaxSize()) {
        TopBar(report?.reference ?: "Report", onBack = { nav.pop() })
        val r = report
        if (r == null) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { Placeholder(180.dp); Placeholder(220.dp) }
            return@Column
        }
        val sent = r.status == "sent" || r.status == "acknowledged"
        val acknowledged = r.status == "acknowledged"
        LazyColumn(contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Badge(reportStatusLabel(r.status), reportStatusTone(r.status))
                    if (r.mode == "test") Badge("Test mode", Tone.Neutral, dot = false)
                }
            }
            if (r.mode == "test" && sent) item { Notice("Test mode: this report was emailed to you instead of the police station.", Tone.Warn) }
            if (r.error != null && !sent) item { Notice(r.error, Tone.Danger) }
            item {
                AppCard(Modifier.fillMaxWidth()) {
                    TimelineStep(Icons.FileText, "Complaint created", formatDateTime(r.created_at), done = true, active = false, last = false)
                    TimelineStep(Icons.Mail, if (sent) "Emailed" else if (r.status == "queued") "Sending email" else "Email not sent", r.sent_to, sent, r.status == "queued", last = false)
                    TimelineStep(
                        Icons.CheckCircle,
                        if (acknowledged) "Acknowledged" + (r.ack_by?.let { " by $it" } ?: "") else "Waiting for the police",
                        if (acknowledged) listOfNotNull(formatDateTime(r.acknowledged_at), r.ack_note).joinToString(" · ") else null,
                        acknowledged,
                        r.status == "sent",
                        last = true,
                    )
                }
            }
            item {
                AppCard(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconBubble(Icons.Shield, Tone.Accent, 42.dp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(r.station_name ?: "Nearest police station", style = MaterialTheme.typography.titleSmall, color = c.ink)
                            r.distance_km?.let { Text("%.1f km away".format(it), style = MaterialTheme.typography.bodySmall, color = c.ink3) }
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                    r.station_address?.let { KeyValue("Address", it) }
                    r.station_phone?.let { phone ->
                        Row(Modifier.clickable { open("tel:$phone") }) { KeyValue("Phone", phone) }
                    }
                    KeyValue("Email", r.station_email ?: "Not known")
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (r.station_lat != null && r.station_lng != null) {
                            AppButton("Directions", {
                                open("geo:${r.station_lat},${r.station_lng}?q=${r.station_lat},${r.station_lng}(" + Uri.encode(r.station_name ?: "Police station") + ")")
                            }, Modifier.weight(1f), kind = ButtonKind.Secondary, icon = Icons.MapPin, height = 44.dp)
                        }
                        AppButton("PDF", { open(app.api.authedUrl("/api/reports/${r.id}/pdf")) }, Modifier.weight(1f), kind = ButtonKind.Secondary, icon = Icons.Download, height = 44.dp)
                    }
                    r.public_url?.let { url ->
                        Spacer(Modifier.height(10.dp))
                        AppButton("Police view", { open(url) }, Modifier.fillMaxWidth(), kind = ButtonKind.Ghost, icon = Icons.ExternalLink, height = 40.dp)
                    }
                }
            }
            item {
                AppCard(Modifier.fillMaxWidth()) {
                    KeyValue("Caller", PhoneNumbers.display(r.caller_number))
                    KeyValue("Type", r.category)
                    r.risk_score?.let { KeyValue("Risk", percent(it)) }
                    r.address?.let { KeyValue("Filed from", it) }
                    Spacer(Modifier.height(6.dp))
                    Text(r.summary, style = MaterialTheme.typography.bodyMedium, color = c.ink2)
                    r.call_id?.let { callId ->
                        Spacer(Modifier.height(12.dp))
                        AppButton("View call", { nav.push(Route.CallDetail(callId)) }, Modifier.fillMaxWidth(), kind = ButtonKind.Secondary, icon = Icons.PhoneIncoming, height = 44.dp)
                    }
                }
            }
            if (!acknowledged) {
                item {
                    AppButton("Send again", {
                        scope.launch {
                            busy = true
                            runCatching { app.api.resend(r.id) }
                                .onSuccess { report = it; Toasts.show("Sending the report again", Tone.Accent) }
                                .onFailure { Toasts.show(it.message ?: "Could not resend", Tone.Danger) }
                            busy = false
                        }
                    }, Modifier.fillMaxWidth(), kind = ButtonKind.Secondary, icon = Icons.Refresh, loading = busy)
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NewReportScreen(app: CallShieldApp, prefill: String?, nav: Navigator) {
    val c = AppTheme.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val log by app.log.entries.collectAsState()
    var number by remember(prefill) { mutableStateOf(prefill?.let { PhoneNumbers.display(it) } ?: "") }
    var category by remember { mutableStateOf(FRAUD_CATEGORIES.first()) }
    var note by remember { mutableStateOf("") }
    var police by remember { mutableStateOf(true) }
    var useLocation by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf<ManualReportResult?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val locationLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }

    val recent = log.filter { it.rejected && it.number.isNotBlank() }.map { it.number }.distinct().take(4)

    suspend fun submit() {
        busy = true
        error = null
        try {
            if (useLocation && police) {
                Locator.current(context)?.let { app.api.setLocation(it.latitude, it.longitude) }
            }
            result = app.api.reportNumber(number, category, note.trim().ifBlank { null }, police)
            app.store.refreshReports()
            app.refreshSyncQuietly()
        } catch (e: Exception) {
            error = e.message
        } finally {
            busy = false
        }
    }

    Column(Modifier.fillMaxSize()) {
        TopBar("Report a number")
        val done = result
        if (done != null) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                AppCard(Modifier.fillMaxWidth()) {
                    IconBubble(Icons.CheckCircle, if (done.duplicate_report) Tone.Warn else Tone.Safe, 52.dp)
                    Spacer(Modifier.height(14.dp))
                    Text(
                        when {
                            done.duplicate_report -> "Already reported today"
                            done.report != null -> "Report ${done.report.reference} is on its way"
                            else -> "Number reported"
                        },
                        style = MaterialTheme.typography.titleLarge,
                        color = c.ink,
                    )
                    done.report?.station_name?.let {
                        Spacer(Modifier.height(4.dp))
                        Text(it, style = MaterialTheme.typography.bodyMedium, color = c.ink3)
                    }
                }
                done.report?.let { report ->
                    AppButton("View report", { nav.push(Route.ReportDetail(report.id)) }, Modifier.fillMaxWidth(), icon = Icons.FileText)
                }
                AppButton("Report another number", {
                    result = null
                    number = ""
                    note = ""
                }, Modifier.fillMaxWidth(), kind = ButtonKind.Secondary)
            }
            return@Column
        }

        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 20.dp)) {
            AppTextField(number, { number = it }, "Phone number", placeholder = "+91 98765 43210", keyboardType = KeyboardType.Phone)
            if (recent.isNotEmpty()) {
                Spacer(Modifier.height(10.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    recent.forEach { n -> Chip(PhoneNumbers.display(n), selected = PhoneNumbers.normalize(number) == n) { number = PhoneNumbers.display(n) } }
                }
            }
            Spacer(Modifier.height(20.dp))
            Text("Type of fraud", style = MaterialTheme.typography.labelLarge, color = c.ink)
            Spacer(Modifier.height(8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                FRAUD_CATEGORIES.forEach { option -> Chip(option, option == category) { category = option } }
            }
            Spacer(Modifier.height(20.dp))
            AppTextField(note, { note = it }, "What happened", placeholder = "They asked for my OTP to stop my account being blocked", singleLine = false, minLines = 3)
            Spacer(Modifier.height(12.dp))
            AppCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                Column(Modifier.padding(horizontal = 12.dp)) {
                    SwitchRow("Send to my police station", police, { police = it }, icon = Icons.Siren)
                    Divider()
                    SwitchRow("Use my current location", useLocation, {
                        useLocation = it
                        if (it && !Locator.hasPermission(context)) {
                            locationLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                        }
                    }, icon = Icons.Locate)
                }
            }
            if (error != null) {
                Spacer(Modifier.height(12.dp))
                Notice(error!!, Tone.Danger)
            }
            Spacer(Modifier.height(20.dp))
            AppButton("Submit report", { scope.launch { submit() } }, Modifier.fillMaxWidth(), icon = Icons.Siren, loading = busy, enabled = PhoneNumbers.normalize(number).isNotBlank())
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
fun Chip(text: String, selected: Boolean, onClick: () -> Unit) {
    val c = AppTheme.colors
    Box(
        Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) c.accentSoft else c.surface)
            .border(1.dp, if (selected) c.accent else c.line, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Text(text, style = MaterialTheme.typography.labelLarge, color = if (selected) c.accentInk else c.ink2)
    }
}
