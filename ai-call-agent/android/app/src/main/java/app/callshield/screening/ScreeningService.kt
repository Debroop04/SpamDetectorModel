package app.callshield.screening

import android.telecom.Call
import android.telecom.CallScreeningService
import app.callshield.CallShieldApp
import app.callshield.data.PhoneNumbers
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Android calls this for every incoming call once Call Shield holds the call screening role.
 * Contacts and the assistant's own number ring; blocked and reported numbers are declined;
 * unknown callers are declined so the SIM's "forward when busy" sends them to the AI assistant.
 */
class ScreeningService : CallScreeningService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onScreenCall(details: Call.Details) {
        if (details.callDirection != Call.Details.DIRECTION_INCOMING) {
            respondToCall(details, CallResponse.Builder().build())
            return
        }
        val app = application as CallShieldApp
        val raw = details.handle?.schemeSpecificPart
        val number = PhoneNumbers.normalize(raw)

        scope.launch {
            val cache = app.cache
            val settings = ScreeningSettings(app.session.sendUnknownToAi, app.session.blockReported, app.session.warnReported)
            val isContact = Contacts.isSaved(this@ScreeningService, raw)
            val known = isContact || number in cache.trusted || number in cache.blocked || number in cache.dangerous
            // A quick live lookup for numbers the cache has never seen. Android allows 5 seconds in total.
            val lookup = if (!known && number.isNotBlank() && app.session.isSignedIn) {
                withTimeoutOrNull(1500) {
                    runCatching { app.api.lookup(number, timeoutMs = 1400) }.getOrNull()
                }?.takeIf { it.reports > 0 }?.let { Danger(it.reports, it.category ?: "Reported spam") }
            } else {
                null
            }
            val decision = ScreeningPolicy.decide(
                CallFacts(number, isContact, cache.lineNumber, cache.blocked, cache.trusted, cache.dangerous, lookup),
                settings,
            )
            respondToCall(details, response(decision))
            app.log.add(
                LoggedCall(
                    number = number,
                    at = System.currentTimeMillis(),
                    rejected = decision is Decision.Reject,
                    reason = decision.reason.label,
                    category = decision.danger?.category,
                    reports = decision.danger?.reports ?: 0,
                ),
            )
            Notifier.decision(this@ScreeningService, number, decision)
            app.refreshSyncQuietly()
        }
    }

    private fun response(decision: Decision): CallResponse = when (decision) {
        is Decision.Allow -> CallResponse.Builder().build()
        is Decision.Reject -> CallResponse.Builder()
            .setDisallowCall(true)
            .setRejectCall(true)
            .setSkipCallLog(false)
            .setSkipNotification(true)
            .build()
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
