package app.callshield.screening

import app.callshield.data.PhoneNumbers
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ScreeningPolicyTest {
    private val unknown = "+919000011111"
    private val line = "+17372212163"
    private val on = ScreeningSettings(sendUnknownToAi = true, blockReported = true, warnReported = true)
    private val off = ScreeningSettings(sendUnknownToAi = false, blockReported = false, warnReported = true)

    private fun decide(facts: CallFacts, settings: ScreeningSettings = on) = ScreeningPolicy.decide(facts, settings)

    @Test
    fun savedContactAlwaysRings() {
        val decision = decide(CallFacts(unknown, isContact = true, blocked = setOf(unknown)))
        assertEquals(Decision.Allow(Reason.Contact), decision)
    }

    @Test
    fun assistantLineRingsSoForwardedSafeCallsReachTheUser() {
        assertEquals(Decision.Allow(Reason.AssistantLine), decide(CallFacts(line, lineNumber = line)))
    }

    @Test
    fun trustedNumberRings() {
        assertEquals(Decision.Allow(Reason.Trusted), decide(CallFacts(unknown, trusted = setOf(unknown))))
    }

    @Test
    fun blockedNumberIsRejected() {
        val decision = decide(CallFacts(unknown, blocked = setOf(unknown)))
        assertTrue(decision is Decision.Reject)
        assertEquals(Reason.Blocked, decision.reason)
    }

    @Test
    fun reportedNumberIsRejectedWhenBlockingIsOn() {
        val danger = Danger(12, "Bank or KYC fraud")
        val decision = decide(CallFacts(unknown, dangerous = mapOf(unknown to danger)))
        assertEquals(Decision.Reject(Reason.Dangerous, danger), decision)
    }

    @Test
    fun liveLookupCountsLikeTheCache() {
        val danger = Danger(4, "Lottery or prize scam")
        assertEquals(Decision.Reject(Reason.Dangerous, danger), decide(CallFacts(unknown, lookup = danger)))
    }

    @Test
    fun unknownCallerGoesToTheAi() {
        assertEquals(Decision.Reject(Reason.UnknownToAi), decide(CallFacts(unknown)))
    }

    @Test
    fun hiddenNumberGoesToTheAi() {
        assertEquals(Decision.Reject(Reason.HiddenToAi), decide(CallFacts("")))
    }

    @Test
    fun withAiOffUnknownCallersRingWithAWarningWhenReported() {
        val danger = Danger(3, "Telemarketing")
        assertEquals(Decision.Allow(Reason.UnknownAllowed, danger), decide(CallFacts(unknown, dangerous = mapOf(unknown to danger)), off))
        assertEquals(Decision.Allow(Reason.UnknownAllowed), decide(CallFacts(unknown), off))
        assertEquals(Decision.Allow(Reason.UnknownAllowed), decide(CallFacts(""), off))
    }

    @Test
    fun numbersAreNormalizedLikeTheBackend() {
        assertEquals("+919876543210", PhoneNumbers.normalize("98765 43210"))
        assertEquals("+919876543210", PhoneNumbers.normalize("09876543210"))
        assertEquals("+919876543210", PhoneNumbers.normalize("+91 98765-43210"))
        assertEquals("+14155550100", PhoneNumbers.normalize("+1 (415) 555-0100"))
        assertEquals("", PhoneNumbers.normalize("12"))
        assertEquals("+91 98765 43210", PhoneNumbers.display("+919876543210"))
    }
}
