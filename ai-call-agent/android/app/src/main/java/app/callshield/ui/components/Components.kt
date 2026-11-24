package app.callshield.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedSecureTextField
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.callshield.ui.Tone
import app.callshield.ui.riskTone
import app.callshield.ui.theme.AppTheme
import app.callshield.ui.theme.Icons
import app.callshield.ui.theme.Palette

val CardShape = RoundedCornerShape(14.dp)

fun Palette.fg(tone: Tone): Color = when (tone) {
    Tone.Neutral -> ink2
    Tone.Accent -> accentInk
    Tone.Safe -> safeInk
    Tone.Warn -> warnInk
    Tone.Danger -> dangerInk
}

fun Palette.soft(tone: Tone): Color = when (tone) {
    Tone.Neutral -> subtle
    Tone.Accent -> accentSoft
    Tone.Safe -> safeSoft
    Tone.Warn -> warnSoft
    Tone.Danger -> dangerSoft
}

fun Palette.solid(tone: Tone): Color = when (tone) {
    Tone.Neutral -> ink3
    Tone.Accent -> accent
    Tone.Safe -> safe
    Tone.Warn -> warn
    Tone.Danger -> danger
}

@Composable
fun AppCard(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, padding: Dp = 16.dp, content: @Composable ColumnScope.() -> Unit) {
    val c = AppTheme.colors
    Column(
        modifier
            .clip(CardShape)
            .background(c.surface)
            .border(BorderStroke(1.dp, c.line), CardShape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(padding),
        content = content,
    )
}

@Composable
fun Badge(text: String, tone: Tone, modifier: Modifier = Modifier, dot: Boolean = true) {
    val c = AppTheme.colors
    Row(
        modifier
            .clip(RoundedCornerShape(7.dp))
            .background(c.soft(tone))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (dot) {
            Box(Modifier.size(6.dp).clip(CircleShape).background(c.solid(tone)))
            Spacer(Modifier.width(6.dp))
        }
        Text(text, style = MaterialTheme.typography.labelMedium, color = c.fg(tone), maxLines = 1)
    }
}

enum class ButtonKind { Primary, Secondary, Danger, Ghost }

@Composable
fun AppButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kind: ButtonKind = ButtonKind.Primary,
    icon: ImageVector? = null,
    loading: Boolean = false,
    enabled: Boolean = true,
    height: Dp = 48.dp,
) {
    val c = AppTheme.colors
    val (bg, fg, border) = when (kind) {
        ButtonKind.Primary -> Triple(c.accent, c.onAccent, null)
        ButtonKind.Secondary -> Triple(c.surface, c.ink, c.line)
        ButtonKind.Danger -> Triple(c.danger, if (c.isDark) Color(0xFF1A0506) else Color.White, null)
        ButtonKind.Ghost -> Triple(Color.Transparent, c.ink2, null)
    }
    val active = enabled && !loading
    val alpha by animateFloatAsState(if (enabled) 1f else 0.5f, label = "button-alpha")
    Row(
        modifier
            .heightIn(min = height)
            .clip(RoundedCornerShape(12.dp))
            .background(bg.copy(alpha = bg.alpha * alpha))
            .then(if (border != null) Modifier.border(1.dp, border, RoundedCornerShape(12.dp)) else Modifier)
            .clickable(enabled = active, onClick = onClick)
            .padding(horizontal = 18.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(18.dp), color = fg, strokeWidth = 2.dp)
            Spacer(Modifier.width(10.dp))
        } else if (icon != null) {
            Icon(icon, null, Modifier.size(18.dp), tint = fg.copy(alpha = alpha))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.SemiBold), color = fg.copy(alpha = alpha))
    }
}

@Composable
fun IconBubble(icon: ImageVector, tone: Tone, size: Dp = 40.dp) {
    val c = AppTheme.colors
    Box(Modifier.size(size).clip(CircleShape).background(c.soft(tone)), contentAlignment = Alignment.Center) {
        Icon(icon, null, Modifier.size(size * 0.45f), tint = c.solid(tone))
    }
}

@Composable
fun RiskMeter(score: Double, modifier: Modifier = Modifier, showValue: Boolean = true) {
    val c = AppTheme.colors
    val tone = riskTone(score)
    val fraction by animateFloatAsState(score.coerceIn(0.0, 1.0).toFloat(), label = "risk")
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f).height(8.dp).clip(CircleShape).background(c.soft(tone))) {
            if (fraction > 0f) {
                Box(Modifier.fillMaxWidth(fraction.coerceAtLeast(0.03f)).height(8.dp).clip(CircleShape).background(c.solid(tone)))
            }
        }
        if (showValue) {
            Spacer(Modifier.width(10.dp))
            Text("${Math.round(score * 100)}%", style = MaterialTheme.typography.titleSmall, color = c.ink, modifier = Modifier.width(40.dp))
        }
    }
}

@Composable
fun StatTile(label: String, value: String, icon: ImageVector, modifier: Modifier = Modifier) {
    val c = AppTheme.colors
    AppCard(modifier, padding = 14.dp) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = c.ink2, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Icon(icon, null, Modifier.size(16.dp), tint = c.ink3)
        }
        Spacer(Modifier.height(10.dp))
        Text(value, style = MaterialTheme.typography.headlineMedium, color = c.ink)
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier, action: String? = null, onAction: (() -> Unit)? = null) {
    val c = AppTheme.colors
    Row(modifier.fillMaxWidth().padding(top = 8.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text, style = MaterialTheme.typography.titleMedium, color = c.ink, modifier = Modifier.weight(1f))
        if (action != null && onAction != null) {
            Text(action, style = MaterialTheme.typography.labelLarge, color = c.accent, modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onAction).padding(6.dp))
        }
    }
}

@Composable
fun EmptyState(icon: ImageVector, text: String, modifier: Modifier = Modifier, action: @Composable (() -> Unit)? = null) {
    val c = AppTheme.colors
    Column(modifier.fillMaxWidth().padding(vertical = 36.dp, horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)).background(c.subtle).border(1.dp, c.line, RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
            Icon(icon, null, Modifier.size(22.dp), tint = c.ink3)
        }
        Spacer(Modifier.height(12.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium), color = c.ink2)
        if (action != null) {
            Spacer(Modifier.height(14.dp))
            action()
        }
    }
}

@Composable
fun Placeholder(height: Dp, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(height).clip(RoundedCornerShape(12.dp)).background(AppTheme.colors.muted))
}

@Composable
fun TopBar(title: String, onBack: (() -> Unit)? = null, actions: @Composable RowScope.() -> Unit = {}) {
    val c = AppTheme.colors
    Row(
        Modifier.fillMaxWidth().background(c.bg).statusBarsPadding().height(60.dp).padding(horizontal = if (onBack != null) 6.dp else 20.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onBack != null) {
            Box(Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onBack), contentAlignment = Alignment.Center) {
                Icon(Icons.ChevronLeft, "Back", Modifier.size(22.dp), tint = c.ink)
            }
            Spacer(Modifier.width(4.dp))
        }
        Text(title, style = MaterialTheme.typography.titleLarge, color = c.ink, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
        Row(verticalAlignment = Alignment.CenterVertically, content = actions)
        if (onBack != null) Spacer(Modifier.width(10.dp))
    }
}

@Composable
fun AppTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    password: Boolean = false,
    singleLine: Boolean = true,
    minLines: Int = 1,
) {
    val c = AppTheme.colors
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = c.accent,
        unfocusedBorderColor = c.line,
        focusedContainerColor = c.surface,
        unfocusedContainerColor = c.surface,
        cursorColor = c.accent,
    )
    if (password) {
        // Secure field: hides characters and blocks copying, without the deprecated VisualTransformation API.
        val state = rememberTextFieldState(value)
        LaunchedEffect(state) {
            snapshotFlow { state.text.toString() }.collect { if (it != value) onValueChange(it) }
        }
        Column(modifier) {
            Text(label, style = MaterialTheme.typography.labelLarge, color = c.ink, modifier = Modifier.padding(bottom = 6.dp))
            OutlinedSecureTextField(
                state = state,
                modifier = Modifier.fillMaxWidth(),
                placeholder = placeholder?.let { { Text(it, color = c.ink3) } },
                shape = RoundedCornerShape(12.dp),
                textStyle = MaterialTheme.typography.bodyLarge.copy(color = c.ink),
                colors = fieldColors,
            )
        }
        return
    }
    Column(modifier) {
        Text(label, style = MaterialTheme.typography.labelLarge, color = c.ink, modifier = Modifier.padding(bottom = 6.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = placeholder?.let { { Text(it, color = c.ink3) } },
            singleLine = singleLine,
            minLines = minLines,
            shape = RoundedCornerShape(12.dp),
            textStyle = MaterialTheme.typography.bodyLarge.copy(color = c.ink),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            colors = fieldColors,
        )
    }
}

@Composable
fun SwitchRow(title: String, checked: Boolean, onChange: (Boolean) -> Unit, modifier: Modifier = Modifier, icon: ImageVector? = null) {
    val c = AppTheme.colors
    Row(
        modifier.fillMaxWidth().clickable { onChange(!checked) }.padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(icon, null, Modifier.size(20.dp), tint = c.ink2)
            Spacer(Modifier.width(14.dp))
        }
        Text(title, style = MaterialTheme.typography.bodyLarge, color = c.ink, modifier = Modifier.weight(1f))
        Spacer(Modifier.width(12.dp))
        Switch(
            checked = checked,
            onCheckedChange = onChange,
            colors = SwitchDefaults.colors(
                checkedTrackColor = c.accent,
                checkedThumbColor = c.onAccent,
                uncheckedTrackColor = c.muted,
                uncheckedThumbColor = c.surface,
                uncheckedBorderColor = c.lineStrong,
            ),
        )
    }
}

@Composable
fun <T> Segmented(options: List<Pair<T, String>>, selected: T, onSelect: (T) -> Unit, modifier: Modifier = Modifier) {
    val c = AppTheme.colors
    Row(modifier.clip(RoundedCornerShape(12.dp)).background(c.subtle).border(1.dp, c.line, RoundedCornerShape(12.dp)).padding(3.dp)) {
        options.forEach { (value, label) ->
            val active = value == selected
            Box(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(9.dp))
                    .background(if (active) c.surface else Color.Transparent)
                    .clickable { onSelect(value) }
                    .padding(vertical = 9.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(label, style = MaterialTheme.typography.labelLarge, color = if (active) c.ink else c.ink3, maxLines = 1)
            }
        }
    }
}

@Composable
fun ListRow(
    title: String,
    modifier: Modifier = Modifier,
    detail: String? = null,
    leading: @Composable (() -> Unit)? = null,
    trailing: @Composable (() -> Unit)? = null,
    onClick: (() -> Unit)? = null,
) {
    val c = AppTheme.colors
    Row(
        modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leading != null) {
            leading()
            Spacer(Modifier.width(12.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium), color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (detail != null) {
                Text(detail, style = MaterialTheme.typography.bodySmall, color = c.ink3, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        if (trailing != null) {
            Spacer(Modifier.width(10.dp))
            trailing()
        }
    }
}

@Composable
fun Divider(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(1.dp).background(AppTheme.colors.line))
}

@Composable
fun KeyValue(label: String, value: String, modifier: Modifier = Modifier) {
    val c = AppTheme.colors
    Row(modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.Top) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = c.ink3, modifier = Modifier.width(120.dp))
        Text(value, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium), color = c.ink, modifier = Modifier.weight(1f))
    }
}

@Composable
fun Notice(text: String, tone: Tone, modifier: Modifier = Modifier, icon: ImageVector = Icons.AlertTriangle) {
    val c = AppTheme.colors
    Row(modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(c.soft(tone)).padding(12.dp), verticalAlignment = Alignment.Top) {
        Icon(icon, null, Modifier.size(18.dp).padding(top = 1.dp), tint = c.fg(tone))
        Spacer(Modifier.width(10.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium, color = c.fg(tone))
    }
}

/** A tiny message bar shown at the bottom of the screen. */
object Toasts {
    var message by mutableStateOf<Pair<String, Tone>?>(null)
    fun show(text: String, tone: Tone = Tone.Safe) {
        message = text to tone
    }
}

@Composable
fun ToastHost(modifier: Modifier = Modifier) {
    val c = AppTheme.colors
    val current = Toasts.message
    androidx.compose.runtime.LaunchedEffect(current) {
        if (current != null) {
            kotlinx.coroutines.delay(3200)
            Toasts.message = null
        }
    }
    AnimatedVisibility(
        visible = current != null,
        enter = fadeIn() + slideInVertically { it / 2 },
        exit = fadeOut() + slideOutVertically { it / 2 },
        modifier = modifier,
    ) {
        val (text, tone) = current ?: ("" to Tone.Neutral)
        Row(
            Modifier
                .padding(horizontal = 16.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(if (c.isDark) c.muted else c.ink)
                .padding(PaddingValues(horizontal = 16.dp, vertical = 14.dp)),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(c.solid(tone)))
            Spacer(Modifier.width(12.dp))
            Text(text, style = MaterialTheme.typography.bodyMedium, color = if (c.isDark) c.ink else c.bg)
        }
    }
}
