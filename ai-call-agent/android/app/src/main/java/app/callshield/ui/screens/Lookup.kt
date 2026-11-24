package app.callshield.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.callshield.CallShieldApp
import app.callshield.data.NumberLookup
import app.callshield.data.PhoneNumbers
import app.callshield.ui.Navigator
import app.callshield.ui.Route
import app.callshield.ui.Tone
import app.callshield.ui.components.AppButton
import app.callshield.ui.components.AppCard
import app.callshield.ui.components.AppTextField
import app.callshield.ui.components.Badge
import app.callshield.ui.components.ButtonKind
import app.callshield.ui.components.IconBubble
import app.callshield.ui.components.Notice
import app.callshield.ui.components.RiskMeter
import app.callshield.ui.components.Toasts
import app.callshield.ui.components.TopBar
import app.callshield.ui.theme.AppTheme
import app.callshield.ui.theme.Icons
import kotlinx.coroutines.launch

@Composable
fun LookupScreen(app: CallShieldApp, nav: Navigator) {
    val c = AppTheme.colors
    val scope = rememberCoroutineScope()
    var number by remember { mutableStateOf("") }
    var result by remember { mutableStateOf<NumberLookup?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun check() = scope.launch {
        busy = true
        error = null
        runCatching { app.api.lookup(number) }.onSuccess { result = it }.onFailure { error = it.message }
        busy = false
    }

    fun rule(kind: String?) = scope.launch {
        val r = result ?: return@launch
        runCatching {
            if (kind == null) app.api.removeRule(r.number) else app.api.setRule(r.number, kind)
            app.cache.addRule(r.number, kind ?: "none")
        }.onSuccess {
            result = r.copy(rule = kind)
            Toasts.show(if (kind == "block") "Number blocked" else if (kind == "allow") "Number trusted" else "Removed from your lists")
        }.onFailure { Toasts.show(it.message ?: "Could not update", Tone.Danger) }
    }

    Column(Modifier.fillMaxSize()) {
        TopBar("Check a number", onBack = { nav.pop() })
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 20.dp)) {
            AppTextField(number, { number = it }, "Phone number", placeholder = "+91 98765 43210", keyboardType = KeyboardType.Phone)
            Spacer(Modifier.height(14.dp))
            AppButton("Check", { check() }, Modifier.fillMaxWidth(), icon = Icons.Search, loading = busy, enabled = PhoneNumbers.normalize(number).isNotBlank())
            error?.let {
                Spacer(Modifier.height(12.dp))
                Notice(it, Tone.Danger)
            }
            result?.let { r ->
                val tone = when (r.level) {
                    "dangerous" -> Tone.Danger
                    "reported" -> Tone.Warn
                    else -> Tone.Safe
                }
                Spacer(Modifier.height(20.dp))
                AppCard(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconBubble(if (r.reports > 0) Icons.ShieldAlert else Icons.ShieldCheck, tone, 48.dp)
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text(PhoneNumbers.display(r.number), style = MaterialTheme.typography.titleMedium, color = c.ink)
                            Text(
                                if (r.reports == 0) "No reports" else "${r.reports} report${if (r.reports == 1) "" else "s"} · ${r.category}",
                                style = MaterialTheme.typography.bodySmall,
                                color = c.ink3,
                            )
                        }
                        Badge(
                            when (r.level) {
                                "dangerous" -> "Dangerous"
                                "reported" -> "Reported"
                                else -> "Clean"
                            },
                            tone,
                        )
                    }
                    if (r.reports > 0) {
                        Spacer(Modifier.height(14.dp))
                        RiskMeter(r.risk)
                    }
                    Spacer(Modifier.height(16.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        AppButton(
                            if (r.rule == "block") "Unblock" else "Block",
                            { rule(if (r.rule == "block") null else "block") },
                            Modifier.weight(1f),
                            kind = ButtonKind.Secondary,
                            icon = Icons.Ban,
                            height = 44.dp,
                        )
                        AppButton(
                            if (r.rule == "allow") "Untrust" else "Trust",
                            { rule(if (r.rule == "allow") null else "allow") },
                            Modifier.weight(1f),
                            kind = ButtonKind.Secondary,
                            icon = Icons.ShieldCheck,
                            height = 44.dp,
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    AppButton("Report this number", { nav.tab(Route.NewReport(r.number)) }, Modifier.fillMaxWidth(), kind = ButtonKind.Danger, icon = Icons.Siren, height = 44.dp)
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}
