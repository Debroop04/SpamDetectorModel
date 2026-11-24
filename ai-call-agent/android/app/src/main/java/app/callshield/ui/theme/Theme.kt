package app.callshield.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.callshield.data.ThemeMode

/** Same tokens as the website (frontend/app/globals.css). Solid colors only. */
@Immutable
data class Palette(
    val bg: Color,
    val surface: Color,
    val subtle: Color,
    val muted: Color,
    val line: Color,
    val lineStrong: Color,
    val ink: Color,
    val ink2: Color,
    val ink3: Color,
    val accent: Color,
    val accentSoft: Color,
    val accentInk: Color,
    val onAccent: Color,
    val safe: Color,
    val safeSoft: Color,
    val safeInk: Color,
    val warn: Color,
    val warnSoft: Color,
    val warnInk: Color,
    val danger: Color,
    val dangerSoft: Color,
    val dangerInk: Color,
    val isDark: Boolean,
)

val LightPalette = Palette(
    bg = Color(0xFFF6F7F9), surface = Color(0xFFFFFFFF), subtle = Color(0xFFF1F3F6), muted = Color(0xFFE9ECF1),
    line = Color(0xFFE3E7ED), lineStrong = Color(0xFFCFD5DE),
    ink = Color(0xFF0E1524), ink2 = Color(0xFF475266), ink3 = Color(0xFF6B7588),
    accent = Color(0xFF0A6FDB), accentSoft = Color(0xFFEAF3FE), accentInk = Color(0xFF0657B0), onAccent = Color.White,
    safe = Color(0xFF12A150), safeSoft = Color(0xFFE9F8EF), safeInk = Color(0xFF0B7A3B),
    warn = Color(0xFFE58A00), warnSoft = Color(0xFFFFF6E5), warnInk = Color(0xFF9A5B00),
    danger = Color(0xFFE5383B), dangerSoft = Color(0xFFFDEEEE), dangerInk = Color(0xFFB42326),
    isDark = false,
)

val DarkPalette = Palette(
    bg = Color(0xFF0A0D14), surface = Color(0xFF11151E), subtle = Color(0xFF161B26), muted = Color(0xFF1D2330),
    line = Color(0xFF222938), lineStrong = Color(0xFF2F3748),
    ink = Color(0xFFEEF1F6), ink2 = Color(0xFFA8B1C2), ink3 = Color(0xFF7B8597),
    accent = Color(0xFF3D98FF), accentSoft = Color(0xFF0F2340), accentInk = Color(0xFF7AB8FF), onAccent = Color(0xFF04101F),
    safe = Color(0xFF35C67A), safeSoft = Color(0xFF0D2419), safeInk = Color(0xFF5EDB98),
    warn = Color(0xFFF5A623), warnSoft = Color(0xFF2A1F0B), warnInk = Color(0xFFFFC061),
    danger = Color(0xFFFF5A5F), dangerSoft = Color(0xFF2C1214), dangerInk = Color(0xFFFF8A8D),
    isDark = true,
)

private val LocalPalette = staticCompositionLocalOf { LightPalette }

object AppTheme {
    val colors: Palette
        @Composable @ReadOnlyComposable get() = LocalPalette.current
}

private val AppTypography = Typography(
    headlineMedium = TextStyle(fontSize = 26.sp, lineHeight = 32.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.4).sp),
    titleLarge = TextStyle(fontSize = 20.sp, lineHeight = 26.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.2).sp),
    titleMedium = TextStyle(fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold),
    titleSmall = TextStyle(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 15.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontSize = 12.sp, lineHeight = 16.sp),
    labelLarge = TextStyle(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.Medium),
    labelMedium = TextStyle(fontSize = 12.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium),
    labelSmall = TextStyle(fontSize = 11.sp, lineHeight = 14.sp, fontWeight = FontWeight.Medium),
)

@Composable
fun CallShieldTheme(mode: ThemeMode, content: @Composable () -> Unit) {
    val dark = when (mode) {
        ThemeMode.System -> isSystemInDarkTheme()
        ThemeMode.Light -> false
        ThemeMode.Dark -> true
    }
    val p = if (dark) DarkPalette else LightPalette
    val scheme = if (dark) {
        darkColorScheme(
            primary = p.accent, onPrimary = p.onAccent, background = p.bg, onBackground = p.ink, surface = p.surface,
            onSurface = p.ink, surfaceVariant = p.subtle, onSurfaceVariant = p.ink2, outline = p.lineStrong,
            outlineVariant = p.line, error = p.danger, surfaceContainerHighest = p.muted,
        )
    } else {
        lightColorScheme(
            primary = p.accent, onPrimary = p.onAccent, background = p.bg, onBackground = p.ink, surface = p.surface,
            onSurface = p.ink, surfaceVariant = p.subtle, onSurfaceVariant = p.ink2, outline = p.lineStrong,
            outlineVariant = p.line, error = p.danger, surfaceContainerHighest = p.muted,
        )
    }
    androidx.compose.runtime.CompositionLocalProvider(LocalPalette provides p) {
        MaterialTheme(colorScheme = scheme, typography = AppTypography, content = content)
    }
}
