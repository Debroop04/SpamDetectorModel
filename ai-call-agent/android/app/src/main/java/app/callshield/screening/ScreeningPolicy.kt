package app.callshield.screening

/** A number reported by the community. */
data class Danger(val reports: Int, val category: String)

data class ScreeningSettings(
    val sendUnknownToAi: Boolean = true,
    val blockReported: Boolean = true,
    val warnReported: Boolean = true,
)

/** Everything known about an incoming call at the moment it rings. */
data class CallFacts(
    val number: String,
    val isContact: Boolean = false,
    val lineNumber: String? = null,
    val blocked: Set<String> = emptySet(),
    val trusted: Set<String> = emptySet(),
    val dangerous: Map<String, Danger> = emptyMap(),
    val lookup: Danger? = null,
)

enum class Reason(val label: String) {
    AssistantLine("Screened by your AI assistant"),
    Contact("Saved contact"),
    Trusted("On your trusted list"),
    Blocked("On your block list"),
    Dangerous("Reported as a scam"),
    UnknownToAi("Unknown caller sent to your AI assistant"),
    HiddenToAi("Hidden number sent to your AI assistant"),
    UnknownAllowed("Unknown caller"),
}

sealed interface Decision {
    val reason: Reason
    val danger: Danger?

    /** Let the phone ring. A danger means: ring, but show a warning. */
    data class Allow(override val reason: Reason, override val danger: Danger? = null) : Decision

    /** Decline the call. Unknown callers then reach the AI assistant through "forward when busy". */
    data class Reject(override val reason: Reason, override val danger: Danger? = null) : Decision
}

/**
 * Decides an incoming call without any network access, so it always answers within Android's 5 second limit.
 * Order matters: the assistant's own number and saved contacts always ring.
 */
object ScreeningPolicy {
    fun decide(facts: CallFacts, settings: ScreeningSettings): Decision {
        val number = facts.number
        if (number.isBlank()) {
            return if (settings.sendUnknownToAi) Decision.Reject(Reason.HiddenToAi) else Decision.Allow(Reason.UnknownAllowed)
        }
        if (facts.lineNumber != null && number == facts.lineNumber) return Decision.Allow(Reason.AssistantLine)
        if (facts.isContact) return Decision.Allow(Reason.Contact)
        if (number in facts.trusted) return Decision.Allow(Reason.Trusted)
        if (number in facts.blocked) return Decision.Reject(Reason.Blocked, facts.dangerous[number])

        val danger = facts.dangerous[number] ?: facts.lookup
        if (danger != null && settings.blockReported) return Decision.Reject(Reason.Dangerous, danger)
        if (settings.sendUnknownToAi) return Decision.Reject(Reason.UnknownToAi, danger)
        return Decision.Allow(Reason.UnknownAllowed, danger.takeIf { settings.warnReported })
    }
}
