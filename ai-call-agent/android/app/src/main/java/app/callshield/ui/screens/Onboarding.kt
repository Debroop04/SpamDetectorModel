package app.callshield.ui.screens

import android.Manifest
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import app.callshield.CallShieldApp
import app.callshield.data.ApiException
import app.callshield.data.Discovery
import app.callshield.data.PhoneNumbers
import app.callshield.data.SessionResponse
import app.callshield.ui.Tone
import app.callshield.ui.components.AppButton
import app.callshield.ui.components.AppCard
import app.callshield.ui.components.AppTextField
import app.callshield.ui.components.Badge
import app.callshield.ui.components.ButtonKind
import app.callshield.ui.components.Divider
import app.callshield.ui.components.IconBubble
import app.callshield.ui.components.Notice
import app.callshield.ui.components.TopBar
import app.callshield.ui.theme.AppTheme
import app.callshield.ui.theme.Icons
import kotlinx.coroutines.launch

@Composable
fun LogoMark(size: Int = 52) {
    val c = AppTheme.colors
    Box(Modifier.size(size.dp).clip(RoundedCornerShape((size * 0.28).dp)).background(c.accent), contentAlignment = Alignment.Center) {
        Icon(Icons.ShieldCheck, null, Modifier.size((size * 0.52).dp), tint = c.onAccent)
    }
}

@Composable
private fun OnboardingFrame(title: String, content: @Composable () -> Unit) {
    val c = AppTheme.colors
    Column(
        Modifier
            .fillMaxSize()
            .background(c.bg)
            .verticalScroll(rememberScrollState())
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
            .padding(horizontal = 24.dp, vertical = 28.dp),
    ) {
        LogoMark()
        Spacer(Modifier.height(28.dp))
        Text(title, style = MaterialTheme.typography.headlineMedium, color = c.ink)
        Spacer(Modifier.height(24.dp))
        content()
    }
}

/** Adds http:// and the default port when someone types only an IP address. */
private fun normalizeServer(input: String): String {
    var s = input.trim().trimEnd('/')
    if (s.isEmpty()) return s
    if (!s.startsWith("http://") && !s.startsWith("https://")) s = "http://$s"
    val host = s.substringAfter("://")
    if (s.startsWith("http://") && !host.contains(":")) s = "$s:8000"
    return s
}

private sealed interface Search {
    data object Looking : Search
    data class Found(val server: String) : Search
    data object Missing : Search
}

@Composable
fun ConnectScreen(app: CallShieldApp, linkedServer: String?, onLinkHandled: () -> Unit, onConnected: () -> Unit) {
    val c = AppTheme.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var search by remember { mutableStateOf<Search>(Search.Looking) }
    var manual by remember { mutableStateOf(linkedServer ?: app.session.server ?: "") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var attempt by remember { mutableIntStateOf(0) }

    suspend fun connect(raw: String) {
        val server = normalizeServer(raw)
        if (server.isBlank()) return
        busy = true
        error = null
        if (app.api.ping(server)) {
            app.session.server = server
            onLinkHandled()
            onConnected()
        } else {
            error = "Could not reach $server. Make sure the backend is running and your phone is on the same Wi-Fi."
        }
        busy = false
    }

    LaunchedEffect(linkedServer) {
        if (linkedServer != null) connect(linkedServer)
    }

    LaunchedEffect(attempt) {
        if (linkedServer != null && attempt == 0) return@LaunchedEffect
        search = Search.Looking
        val found = Discovery.find(context)
        search = if (found != null && app.api.ping(found)) Search.Found(found) else Search.Missing
    }

    OnboardingFrame("Connect to Call Shield") {
        when (val s = search) {
            Search.Looking -> AppCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(Modifier.size(20.dp), color = c.accent, strokeWidth = 2.dp)
                    Spacer(Modifier.width(14.dp))
                    Text("Looking for your server on this Wi-Fi", style = MaterialTheme.typography.bodyLarge, color = c.ink)
                }
            }
            is Search.Found -> AppCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconBubble(Icons.Wifi, Tone.Safe)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Server found", style = MaterialTheme.typography.titleSmall, color = c.ink)
                        Text(s.server, style = MaterialTheme.typography.bodySmall, color = c.ink3)
                    }
                }
                Spacer(Modifier.height(14.dp))
                AppButton("Connect", { scope.launch { connect(s.server) } }, Modifier.fillMaxWidth(), loading = busy)
            }
            Search.Missing -> Notice("No server found automatically. Open the download page on the website and tap Open app, or type the address below.", Tone.Warn)
        }

        Spacer(Modifier.height(24.dp))
        AppTextField(manual, { manual = it }, "Server address", placeholder = "http://192.168.1.5:8000", keyboardType = KeyboardType.Uri)
        if (error != null) {
            Spacer(Modifier.height(12.dp))
            Notice(error!!, Tone.Danger)
        }
        Spacer(Modifier.height(16.dp))
        AppButton("Connect", { scope.launch { connect(manual) } }, Modifier.fillMaxWidth(), kind = ButtonKind.Secondary, loading = busy && search !is Search.Found, enabled = manual.isNotBlank())
        Spacer(Modifier.height(8.dp))
        AppButton("Search again", { attempt++ }, Modifier.fillMaxWidth(), kind = ButtonKind.Ghost, icon = Icons.Refresh)
    }
}

private fun signedIn(app: CallShieldApp, response: SessionResponse) {
    app.session.token = response.token
    app.session.userName = response.user.name
    app.store.user = response.user
    app.store.refreshAll()
    app.store.foreground = true
    app.store.startLive()
}

@Composable
fun LoginScreen(app: CallShieldApp, onRegister: () -> Unit, onChangeServer: () -> Unit, onSignedIn: () -> Unit) {
    val c = AppTheme.colors
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    OnboardingFrame("Sign in") {
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(c.subtle).clickable(onClick = onChangeServer).padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Wifi, null, Modifier.size(16.dp), tint = c.safe)
            Spacer(Modifier.width(10.dp))
            Text(app.session.server ?: "", style = MaterialTheme.typography.bodySmall, color = c.ink2, modifier = Modifier.weight(1f), maxLines = 1)
            Text("Change", style = MaterialTheme.typography.labelMedium, color = c.accent)
        }
        Spacer(Modifier.height(20.dp))
        AppTextField(email, { email = it.trim() }, "Email", keyboardType = KeyboardType.Email)
        Spacer(Modifier.height(14.dp))
        AppTextField(password, { password = it }, "Password", password = true)
        if (error != null) {
            Spacer(Modifier.height(12.dp))
            Notice(error!!, Tone.Danger)
        }
        Spacer(Modifier.height(20.dp))
        AppButton(
            "Sign in",
            {
                scope.launch {
                    busy = true
                    error = null
                    try {
                        signedIn(app, app.api.login(email, password))
                        onSignedIn()
                    } catch (e: ApiException) {
                        error = e.message
                    } finally {
                        busy = false
                    }
                }
            },
            Modifier.fillMaxWidth(),
            loading = busy,
            enabled = email.isNotBlank() && password.isNotBlank(),
        )
        Spacer(Modifier.height(10.dp))
        AppButton("Create an account", onRegister, Modifier.fillMaxWidth(), kind = ButtonKind.Ghost)
    }
}

@Composable
fun RegisterScreen(app: CallShieldApp, onBack: () -> Unit, onSignedIn: () -> Unit) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxSize()) {
        TopBar("", onBack = onBack)
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 24.dp)) {
            Text("Create your account", style = MaterialTheme.typography.headlineMedium, color = AppTheme.colors.ink)
            Spacer(Modifier.height(24.dp))
            AppTextField(name, { name = it }, "Full name")
            Spacer(Modifier.height(14.dp))
            AppTextField(email, { email = it.trim() }, "Email", keyboardType = KeyboardType.Email)
            Spacer(Modifier.height(14.dp))
            AppTextField(password, { password = it }, "Password", password = true, placeholder = "At least 8 characters")
            if (error != null) {
                Spacer(Modifier.height(12.dp))
                Notice(error!!, Tone.Danger)
            }
            Spacer(Modifier.height(20.dp))
            AppButton(
                "Create account",
                {
                    scope.launch {
                        busy = true
                        error = null
                        try {
                            signedIn(app, app.api.register(name.trim(), email, password))
                            onSignedIn()
                        } catch (e: ApiException) {
                            error = e.message
                        } finally {
                            busy = false
                        }
                    }
                },
                Modifier.fillMaxWidth(),
                loading = busy,
                enabled = name.length >= 2 && email.contains("@") && password.length >= 8,
            )
            Spacer(Modifier.height(24.dp))
        }
    }
}

// ---------- Setup checklist ----------

private fun granted(context: Context, permission: String) = context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

private fun holdsScreeningRole(context: Context): Boolean {
    val roles = context.getSystemService(RoleManager::class.java)
    return roles.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) && roles.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
}

/** What the phone has granted so far. Re-read whenever the screen resumes. */
data class SetupStatus(val roleHeld: Boolean, val contacts: Boolean, val notifications: Boolean, val location: Boolean) {
    val complete get() = roleHeld && contacts && notifications

    companion object {
        fun read(context: Context) = SetupStatus(
            roleHeld = holdsScreeningRole(context),
            contacts = granted(context, Manifest.permission.READ_CONTACTS),
            notifications = Build.VERSION.SDK_INT < 33 || granted(context, Manifest.permission.POST_NOTIFICATIONS),
            location = granted(context, Manifest.permission.ACCESS_FINE_LOCATION) || granted(context, Manifest.permission.ACCESS_COARSE_LOCATION),
        )
    }
}

@Composable
private fun SetupItem(icon: ImageVector, title: String, done: Boolean, action: String, onAction: () -> Unit) {
    val c = AppTheme.colors
    Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        IconBubble(if (done) Icons.Check else icon, if (done) Tone.Safe else Tone.Accent, 40.dp)
        Spacer(Modifier.width(14.dp))
        Text(title, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium), color = c.ink, modifier = Modifier.weight(1f))
        if (done) Badge("Done", Tone.Safe) else AppButton(action, onAction, kind = ButtonKind.Secondary, height = 38.dp)
    }
}

@Composable
fun SetupScreen(app: CallShieldApp, onBack: () -> Unit) {
    val c = AppTheme.colors
    val context = LocalContext.current
    var refresh by remember { mutableIntStateOf(0) }
    LifecycleResumeEffect(Unit) {
        refresh++
        onPauseOrDispose { }
    }
    val roleLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { refresh++ }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { refresh++ }
    var forwardingDone by remember { mutableStateOf(app.session.forwardingDone) }

    val status = remember(refresh) { SetupStatus.read(context) }
    val roleHeld = status.roleHeld
    val contacts = status.contacts
    val notifications = status.notifications
    val location = status.location
    val forwardTo = app.store.sync?.forward_to ?: app.cache.lineNumber

    Column(Modifier.fillMaxSize()) {
        TopBar("Set up protection", onBack = onBack)
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
            AppCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                Column(Modifier.padding(horizontal = 12.dp)) {
                    SetupItem(Icons.ShieldCheck, "Screen incoming calls", roleHeld, "Allow") {
                        val roles = context.getSystemService(RoleManager::class.java)
                        roleLauncher.launch(roles.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING))
                    }
                    Divider()
                    SetupItem(Icons.Users, "Let saved contacts ring", contacts, "Allow") {
                        permissionLauncher.launch(arrayOf(Manifest.permission.READ_CONTACTS))
                    }
                    Divider()
                    SetupItem(Icons.Bell, "Scam alerts", notifications, "Allow") {
                        if (Build.VERSION.SDK_INT >= 33) permissionLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
                    }
                    Divider()
                    SetupItem(Icons.MapPin, "Nearest police station", location, "Allow") {
                        permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
            AppCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconBubble(if (forwardingDone) Icons.Check else Icons.PhoneForwarded, if (forwardingDone) Tone.Safe else Tone.Accent)
                    Spacer(Modifier.width(14.dp))
                    Text("Send unknown calls to the AI", style = MaterialTheme.typography.titleSmall, color = c.ink, modifier = Modifier.weight(1f))
                    if (forwardingDone) Badge("Done", Tone.Safe)
                }
                Spacer(Modifier.height(14.dp))
                if (forwardTo == null) {
                    Notice("The server has no Twilio number yet. Add TWILIO_PHONE_NUMBER on the server first.", Tone.Warn)
                } else {
                    val code = "**67*$forwardTo#"
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(c.subtle).padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text("Forward when busy to", style = MaterialTheme.typography.bodySmall, color = c.ink3)
                            Text(PhoneNumbers.display(forwardTo), style = MaterialTheme.typography.titleMedium, color = c.ink)
                        }
                        Text(code, style = MaterialTheme.typography.labelMedium, color = c.ink2)
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "Call Shield declines unknown callers. Your SIM then forwards them to the AI assistant. Tap Set up to dial the code, or on Jio open Phone settings > Calls > Call forwarding > When busy.",
                        style = MaterialTheme.typography.bodySmall,
                        color = c.ink3,
                    )
                    Spacer(Modifier.height(14.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        AppButton("Set up", {
                            context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(code))))
                        }, Modifier.weight(1f), icon = Icons.Phone)
                        AppButton(if (forwardingDone) "Undo" else "Mark done", {
                            forwardingDone = !forwardingDone
                            app.session.forwardingDone = forwardingDone
                        }, Modifier.weight(1f), kind = ButtonKind.Secondary)
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
            AppButton("Continue", onBack, Modifier.fillMaxWidth())
            Spacer(Modifier.height(24.dp))
        }
    }
}
