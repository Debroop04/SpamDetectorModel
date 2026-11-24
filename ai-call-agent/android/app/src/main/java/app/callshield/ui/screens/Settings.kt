package app.callshield.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import app.callshield.BuildConfig
import app.callshield.CallShieldApp
import app.callshield.data.PhoneNumbers
import app.callshield.data.ThemeMode
import app.callshield.ui.Navigator
import app.callshield.ui.Route
import app.callshield.ui.Tone
import app.callshield.ui.components.AppButton
import app.callshield.ui.components.AppCard
import app.callshield.ui.components.Badge
import app.callshield.ui.components.ButtonKind
import app.callshield.ui.components.Divider
import app.callshield.ui.components.KeyValue

import app.callshield.ui.components.SectionTitle
import app.callshield.ui.components.Segmented
import app.callshield.ui.components.SwitchRow
import app.callshield.ui.components.TopBar
import app.callshield.ui.theme.AppTheme
import app.callshield.ui.theme.Icons

@Composable
fun SettingsScreen(app: CallShieldApp, nav: Navigator) {
    val c = AppTheme.colors
    val session = app.session
    val user = app.store.user
    var sendToAi by remember { mutableStateOf(session.sendUnknownToAi) }
    var blockReported by remember { mutableStateOf(session.blockReported) }
    var warnReported by remember { mutableStateOf(session.warnReported) }

    Column(Modifier.fillMaxSize()) {
        TopBar("Settings")
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            AppCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val name = user?.name ?: session.userName ?: "You"
                    Box(Modifier.size(48.dp).clip(CircleShape).background(c.accentSoft), contentAlignment = Alignment.Center) {
                        Text(
                            name.split(" ").mapNotNull { it.firstOrNull()?.uppercase() }.take(2).joinToString(""),
                            style = MaterialTheme.typography.titleMedium,
                            color = c.accentInk,
                        )
                    }
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(name, style = MaterialTheme.typography.titleMedium, color = c.ink)
                        user?.email?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = c.ink3, maxLines = 1) }
                    }
                    if (user?.role == "admin") Badge("Admin", Tone.Accent)
                }
                user?.phone?.let {
                    Spacer(Modifier.height(6.dp))
                    KeyValue("Phone", PhoneNumbers.display(it))
                }
                user?.station?.let { KeyValue("Police station", it.name) }
            }

            SectionTitle("Call protection", Modifier.padding(top = 12.dp))
            AppCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                Column(Modifier.padding(horizontal = 12.dp)) {
                    SwitchRow("Send unknown callers to the AI", sendToAi, { sendToAi = it; session.sendUnknownToAi = it }, icon = Icons.Bot)
                    Divider()
                    SwitchRow("Block reported scam numbers", blockReported, { blockReported = it; session.blockReported = it }, icon = Icons.Ban)
                    Divider()
                    SwitchRow("Warn me about reported numbers", warnReported, { warnReported = it; session.warnReported = it }, icon = Icons.Bell)
                    Divider()
                    Row(
                        Modifier.fillMaxWidth().clickable { nav.push(Route.Setup) }.padding(vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        androidx.compose.material3.Icon(Icons.ShieldCheck, null, Modifier.size(20.dp), tint = c.ink2)
                        Spacer(Modifier.width(14.dp))
                        Text("Setup checklist", style = MaterialTheme.typography.bodyLarge, color = c.ink, modifier = Modifier.weight(1f))
                        androidx.compose.material3.Icon(Icons.ChevronRight, null, Modifier.size(18.dp), tint = c.ink3)
                    }
                }
            }

            SectionTitle("Appearance", Modifier.padding(top = 12.dp))
            Segmented(
                listOf(ThemeMode.System to "System", ThemeMode.Light to "Light", ThemeMode.Dark to "Dark"),
                app.store.theme,
                {
                    session.theme = it
                    app.store.theme = it
                },
                Modifier.fillMaxWidth(),
            )

            SectionTitle("Server", Modifier.padding(top = 12.dp))
            AppCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(8.dp).clip(CircleShape).background(if (app.store.liveConnected) c.safe else c.warn))
                    Spacer(Modifier.width(10.dp))
                    Text(session.server ?: "", style = MaterialTheme.typography.bodyMedium, color = c.ink, modifier = Modifier.weight(1f), maxLines = 1)
                }
                Spacer(Modifier.height(12.dp))
                AppButton("Change server", {
                    session.signOut()
                    app.store.clear()
                    app.cache.clear()
                    nav.reset(Route.Connect)
                }, Modifier.fillMaxWidth(), kind = ButtonKind.Secondary, icon = Icons.Wifi, height = 44.dp)
            }

            Spacer(Modifier.height(16.dp))
            AppButton("Sign out", {
                session.signOut()
                app.store.clear()
                app.cache.clear()
                nav.reset(Route.Login)
            }, Modifier.fillMaxWidth(), kind = ButtonKind.Ghost, icon = Icons.LogOut)
            Text(
                "Call Shield ${BuildConfig.VERSION_NAME} · Cyber helpline 1930",
                style = MaterialTheme.typography.bodySmall,
                color = c.ink3,
                modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }
}
