package app.callshield

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import app.callshield.ui.AppRoot
import app.callshield.ui.theme.CallShieldTheme

class MainActivity : ComponentActivity() {
    /** Server address from a callshield://connect?server=… link on the website's download page. */
    private val linkedServer = mutableStateOf<String?>(null)

    private val app get() = application as CallShieldApp

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        readLink(intent)
        setContent {
            CallShieldTheme(app.store.theme) {
                AppRoot(app, linkedServer.value) { linkedServer.value = null }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        readLink(intent)
    }

    private fun readLink(intent: Intent?) {
        val data: Uri = intent?.data ?: return
        if (data.scheme == "callshield" && data.host == "connect") {
            linkedServer.value = data.getQueryParameter("server")?.trim()?.trimEnd('/')
        }
    }

    override fun onStart() {
        super.onStart()
        app.store.foreground = true
        if (app.session.isSignedIn) {
            app.store.startLive()
            app.store.refreshAll()
        }
    }

    override fun onStop() {
        app.store.foreground = false
        app.store.stopLive()
        super.onStop()
    }
}
