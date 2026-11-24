package app.callshield.screening

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import app.callshield.MainActivity
import app.callshield.R
import app.callshield.data.PhoneNumbers

object Notifier {
    private const val CHANNEL_SCREENING = "screening"
    private const val CHANNEL_WARNINGS = "warnings"
    private const val BRAND = 0xFF0A6FDB.toInt()

    fun createChannels(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannels(
            listOf(
                NotificationChannel(CHANNEL_SCREENING, context.getString(R.string.channel_screening), NotificationManager.IMPORTANCE_DEFAULT),
                NotificationChannel(CHANNEL_WARNINGS, context.getString(R.string.channel_warnings), NotificationManager.IMPORTANCE_HIGH),
            ),
        )
    }

    private fun canPost(context: Context) =
        context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun decision(context: Context, number: String, decision: Decision) {
        if (!canPost(context)) return
        val shown = PhoneNumbers.display(number.ifBlank { null })
        val danger = decision.danger
        val (title, text, channel) = when {
            decision is Decision.Reject && decision.reason == Reason.Blocked -> Triple("Blocked $shown", "This number is on your block list.", CHANNEL_SCREENING)
            decision is Decision.Reject && decision.reason == Reason.Dangerous ->
                Triple("Blocked scam call", "$shown was reported ${danger?.reports} times as ${danger?.category}.", CHANNEL_WARNINGS)
            decision is Decision.Reject ->
                Triple(
                    "AI assistant is answering $shown",
                    danger?.let { "Reported ${it.reports} times as ${it.category}." } ?: "Unknown caller. You will see the result in Call Shield.",
                    CHANNEL_SCREENING,
                )
            danger != null -> Triple("Possible scam: $shown", "Reported ${danger.reports} times as ${danger.category}. Do not share OTPs or bank details.", CHANNEL_WARNINGS)
            else -> return
        }
        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = Notification.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(BRAND)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(Notification.BigTextStyle().bigText(text))
            .setCategory(Notification.CATEGORY_CALL)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        context.getSystemService(NotificationManager::class.java).notify(number.hashCode(), notification)
    }
}
