package app.callshield

import android.app.Application
import app.callshield.data.Api
import app.callshield.data.AppStore
import app.callshield.data.Session
import app.callshield.screening.DecisionLog
import app.callshield.screening.Notifier
import app.callshield.screening.ScreeningCache
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Holds the few app-wide objects. Plain constructors keep startup fast (no DI framework). */
class CallShieldApp : Application() {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    lateinit var session: Session
        private set
    lateinit var api: Api
        private set
    lateinit var cache: ScreeningCache
        private set
    lateinit var log: DecisionLog
        private set
    lateinit var store: AppStore
        private set

    override fun onCreate() {
        super.onCreate()
        session = Session(this)
        api = Api(session)
        cache = ScreeningCache(this)
        log = DecisionLog(this)
        store = AppStore(this)
        Notifier.createChannels(this)
    }

    /** Refresh the call screening lists in the background; failures are ignored (the cache stays). */
    fun refreshSyncQuietly() {
        if (!session.isSignedIn) return
        scope.launch {
            runCatching { api.sync() }.onSuccess { cache.update(it) }
        }
    }
}
