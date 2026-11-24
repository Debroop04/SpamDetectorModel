package app.callshield.ui

import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

enum class Tone { Neutral, Accent, Safe, Warn, Danger }

private val dateTime = DateTimeFormatter.ofPattern("d MMM, h:mm a", Locale.ENGLISH)
private val timeOnly = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH)

fun parseInstant(iso: String?): Instant? = iso?.let { runCatching { Instant.parse(it) }.getOrNull() }

fun timeAgo(iso: String?): String = parseInstant(iso)?.let { timeAgo(it.toEpochMilli()) } ?: ""

fun timeAgo(epochMs: Long): String {
    val seconds = Duration.between(Instant.ofEpochMilli(epochMs), Instant.now()).seconds.coerceAtLeast(0)
    return when {
        seconds < 45 -> "Just now"
        seconds < 3600 -> "${seconds / 60} min ago"
        seconds < 86400 -> "${seconds / 3600} h ago"
        seconds < 7 * 86400 -> "${seconds / 86400} d ago"
        else -> dateTime.format(Instant.ofEpochMilli(epochMs).atZone(ZoneId.systemDefault()))
    }
}

fun formatDateTime(iso: String?): String = parseInstant(iso)?.atZone(ZoneId.systemDefault())?.let(dateTime::format) ?: ""

fun formatTime(iso: String?): String = parseInstant(iso)?.atZone(ZoneId.systemDefault())?.let(timeOnly::format) ?: ""

fun percent(value: Double?): String = "${Math.round((value ?: 0.0) * 100)}%"

fun riskTone(score: Double): Tone = when {
    score >= 0.75 -> Tone.Danger
    score >= 0.45 -> Tone.Warn
    else -> Tone.Safe
}

fun verdictLabel(verdict: String) = when (verdict) {
    "spam" -> "Scam"
    "suspicious" -> "Suspicious"
    "safe" -> "Safe"
    else -> "Screening"
}

fun verdictTone(verdict: String) = when (verdict) {
    "spam" -> Tone.Danger
    "suspicious" -> Tone.Warn
    "safe" -> Tone.Safe
    else -> Tone.Neutral
}

fun statusLabel(status: String) = when (status) {
    "screening" -> "Screening"
    "forwarding" -> "Ringing you"
    "connected" -> "Connected"
    "voicemail" -> "Voicemail"
    "blocked" -> "Blocked"
    "missed" -> "Missed"
    "ended" -> "Caller hung up"
    else -> status.replaceFirstChar { it.uppercase() }
}

fun reportStatusLabel(status: String) = when (status) {
    "queued" -> "Sending"
    "sent" -> "Sent"
    "needs_email" -> "Needs email"
    "failed" -> "Failed"
    "acknowledged" -> "Acknowledged"
    else -> status
}

fun reportStatusTone(status: String) = when (status) {
    "sent" -> Tone.Accent
    "acknowledged" -> Tone.Safe
    "needs_email" -> Tone.Warn
    "failed" -> Tone.Danger
    else -> Tone.Neutral
}

val FRAUD_CATEGORIES = listOf(
    "Bank or KYC fraud",
    "OTP or PIN theft",
    "Fake police or legal threat",
    "Lottery or prize scam",
    "Payment or fee demand",
    "Remote access request",
    "Utility disconnection threat",
    "Investment or job scam",
    "Telemarketing",
    "Other scam",
)
