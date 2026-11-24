package app.callshield.ui.theme

import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

/**
 * A small set of Lucide icons (ISC license, lucide.dev), the same family the website uses.
 * Built from path data at first use, so the app ships no icon library.
 */
object Icons {
    private fun icon(name: String, vararg paths: String): ImageVector =
        ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f).apply {
            paths.forEach {
                addPath(
                    pathData = PathParser().parsePathString(it).toNodes(),
                    stroke = SolidColor(androidx.compose.ui.graphics.Color.Black),
                    strokeLineWidth = 2f,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                )
            }
        }.build()

    private fun circle(cx: Float, cy: Float, r: Float) = "M${cx - r} ${cy}a$r $r 0 1 0 ${2 * r} 0a$r $r 0 1 0 ${-2 * r} 0"

    private fun rect(x: Float, y: Float, w: Float, h: Float, rx: Float) =
        "M${x + rx} ${y}h${w - 2 * rx}a$rx $rx 0 0 1 $rx ${rx}v${h - 2 * rx}a$rx $rx 0 0 1 ${-rx} ${rx}h${-(w - 2 * rx)}a$rx $rx 0 0 1 ${-rx} ${-rx}v${-(h - 2 * rx)}a$rx $rx 0 0 1 $rx ${-rx}z"

    private const val SHIELD =
        "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
    private const val PHONE =
        "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"

    val Shield by lazy { icon("shield", SHIELD) }
    val ShieldCheck by lazy { icon("shield-check", SHIELD, "m9 12 2 2 4-4") }
    val ShieldAlert by lazy { icon("shield-alert", SHIELD, "M12 8v4", "M12 16h.01") }
    val Phone by lazy { icon("phone", PHONE) }
    val PhoneIncoming by lazy { icon("phone-incoming", PHONE, "M16 2v6h6", "M22 2l-6 6") }
    val PhoneForwarded by lazy { icon("phone-forwarded", PHONE, "M18 2l4 4-4 4", "M14 6h8") }
    val Home by lazy {
        icon(
            "house",
            "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
            "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
        )
    }
    val FileText by lazy {
        icon("file-text", "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", "M14 2v4a2 2 0 0 0 2 2h4", "M10 9H8", "M16 13H8", "M16 17H8")
    }
    val Settings by lazy { icon("settings-2", "M20 7h-9", "M14 17H5", circle(17f, 17f, 3f), circle(7f, 7f, 3f)) }
    val PlusCircle by lazy { icon("circle-plus", circle(12f, 12f, 10f), "M8 12h8", "M12 8v8") }
    val Search by lazy { icon("search", circle(11f, 11f, 8f), "m21 21-4.3-4.3") }
    val MapPin by lazy { icon("map-pin", "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0", circle(12f, 10f, 3f)) }
    val User by lazy { icon("user", "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", circle(12f, 7f, 4f)) }
    val Users by lazy {
        icon("users", "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", circle(9f, 7f, 4f), "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75")
    }
    val Bot by lazy { icon("bot", "M12 8V4H8", rect(4f, 8f, 16f, 12f, 2f), "M2 14h2", "M20 14h2", "M15 13v2", "M9 13v2") }
    val Ban by lazy { icon("ban", circle(12f, 12f, 10f), "m4.9 4.9 14.2 14.2") }
    val Check by lazy { icon("check", "M20 6 9 17l-5-5") }
    val CheckCircle by lazy { icon("circle-check", circle(12f, 12f, 10f), "m9 12 2 2 4-4") }
    val X by lazy { icon("x", "M18 6 6 18", "m6 6 12 12") }
    val ChevronRight by lazy { icon("chevron-right", "m9 18 6-6-6-6") }
    val ChevronLeft by lazy { icon("chevron-left", "m15 18-6-6 6-6") }
    val Bell by lazy { icon("bell", "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0") }
    val Wifi by lazy { icon("wifi", "M12 20h.01", "M2 8.82a15 15 0 0 1 20 0", "M5 12.859a10 10 0 0 1 14 0", "M8.5 16.429a5 5 0 0 1 7 0") }
    val Refresh by lazy {
        icon("refresh-cw", "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", "M8 16H3v5")
    }
    val ExternalLink by lazy { icon("external-link", "M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6") }
    val LogOut by lazy { icon("log-out", "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9") }
    val Sun by lazy {
        icon("sun", circle(12f, 12f, 4f), "M12 2v2", "M12 20v2", "m4.93 4.93 1.41 1.41", "m17.66 17.66 1.41 1.41", "M2 12h2", "M20 12h2", "m6.34 17.66-1.41 1.41", "m19.07 4.93-1.41 1.41")
    }
    val Moon by lazy { icon("moon", "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z") }
    val Mail by lazy { icon("mail", rect(2f, 4f, 20f, 16f, 2f), "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7") }
    val Siren by lazy {
        icon(
            "siren", "M7 18v-6a5 5 0 1 1 10 0v6", "M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z",
            "M21 12h1", "M18.5 4.5 18 5", "M2 12h1", "M12 2v1", "m4.929 4.929.707.707", "M12 12v6",
        )
    }
    val Globe by lazy { icon("globe", circle(12f, 12f, 10f), "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20", "M2 12h20") }
    val AlertTriangle by lazy { icon("triangle-alert", "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3", "M12 9v4", "M12 17h.01") }
    val Locate by lazy { icon("locate", "M2 12h3", "M19 12h3", "M12 2v3", "M12 19v3", circle(12f, 12f, 7f), circle(12f, 12f, 3f)) }
    val Clock by lazy { icon("clock", circle(12f, 12f, 10f), "M12 6v6l4 2") }
    val Download by lazy { icon("download", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3") }
    val Hash by lazy { icon("hash", "M4 9h16", "M4 15h16", "M10 3 8 21", "M16 3l-2 18") }
}
