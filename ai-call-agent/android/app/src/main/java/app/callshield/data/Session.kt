package app.callshield.data

import android.content.Context
import androidx.core.content.edit

enum class ThemeMode { System, Light, Dark }

/** Small persisted settings. SharedPreferences keeps startup fast; nothing here is large. */
class Session(context: Context) {
    private val prefs = context.getSharedPreferences("callshield", Context.MODE_PRIVATE)

    var server: String?
        get() = prefs.getString("server", null)
        set(value) = prefs.edit { putString("server", value?.trimEnd('/')) }

    var token: String?
        get() = prefs.getString("token", null)
        set(value) = prefs.edit { putString("token", value) }

    var userName: String?
        get() = prefs.getString("user_name", null)
        set(value) = prefs.edit { putString("user_name", value) }

    var theme: ThemeMode
        get() = runCatching { ThemeMode.valueOf(prefs.getString("theme", "System")!!) }.getOrDefault(ThemeMode.System)
        set(value) = prefs.edit { putString("theme", value.name) }

    /** Decline unknown callers so the SIM forwards them to the AI assistant. */
    var sendUnknownToAi: Boolean
        get() = prefs.getBoolean("send_unknown_to_ai", true)
        set(value) = prefs.edit { putBoolean("send_unknown_to_ai", value) }

    /** Reject numbers the community reported as dangerous. */
    var blockReported: Boolean
        get() = prefs.getBoolean("block_reported", true)
        set(value) = prefs.edit { putBoolean("block_reported", value) }

    /** Show a warning notification while a reported number is ringing. */
    var warnReported: Boolean
        get() = prefs.getBoolean("warn_reported", true)
        set(value) = prefs.edit { putBoolean("warn_reported", value) }

    var forwardingDone: Boolean
        get() = prefs.getBoolean("forwarding_done", false)
        set(value) = prefs.edit { putBoolean("forwarding_done", value) }

    val isSignedIn: Boolean get() = !server.isNullOrBlank() && !token.isNullOrBlank()

    fun signOut() = prefs.edit {
        remove("token")
        remove("user_name")
    }
}
