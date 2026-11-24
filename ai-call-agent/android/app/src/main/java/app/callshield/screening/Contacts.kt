package app.callshield.screening

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.ContactsContract

/** Checks the phone's own address book. Nothing is uploaded. */
object Contacts {
    fun canRead(context: Context): Boolean =
        context.checkSelfPermission(Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED

    fun isSaved(context: Context, rawNumber: String?): Boolean {
        if (rawNumber.isNullOrBlank() || !canRead(context)) return false
        val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(rawNumber))
        return runCatching {
            context.contentResolver.query(uri, arrayOf(ContactsContract.PhoneLookup._ID), null, null, null)?.use { it.moveToFirst() } ?: false
        }.getOrDefault(false)
    }
}
