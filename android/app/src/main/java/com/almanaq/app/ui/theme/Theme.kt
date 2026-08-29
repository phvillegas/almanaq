package com.almanaq.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * The Sol y Luna theme.
 *
 * Dynamic colour is deliberately absent: Material You would repaint the brand violet
 * from the user's wallpaper. PLAN.md section 8 requires it to be off, so this file
 * never reads `dynamicLightColorScheme`.
 *
 * Values come from `design/tokens.json`. Do not copy hex values in here from anywhere
 * else — `Color.kt` transcribes the token file and nothing else does.
 */

private val LightColors = lightColorScheme(
    primary = Vesper500,
    onPrimary = Color.White,
    primaryContainer = Vesper050,
    onPrimaryContainer = Vesper700,
    secondary = Slate,
    onSecondary = Color.White,
    background = Paper,
    onBackground = Nocturne,
    surface = Color.White,
    onSurface = Nocturne,
    surfaceVariant = SurfaceTonalLight,
    onSurfaceVariant = Slate,
    outline = SlateLight,
    outlineVariant = Mist,
)

private val DarkColors = darkColorScheme(
    primary = Vesper300,
    // Not white. See the note on OnAccentDark.
    onPrimary = OnAccentDark,
    primaryContainer = AccentSubtleDark,
    onPrimaryContainer = Vesper200,
    secondary = SlateLight,
    onSecondary = OnAccentDark,
    background = Void,
    onBackground = Starlight,
    surface = SurfaceDark,
    onSurface = Starlight,
    surfaceVariant = SurfaceDarkTonal,
    onSurfaceVariant = SlateLight,
    outline = TextDisabledDark,
    outlineVariant = BorderDark,
)

/**
 * Colours the Material 3 role system has no slot for: the availability statuses and
 * the pressed variant of the brand colour.
 *
 * The client never decides these. It receives `status` from the API and looks the
 * colours up here. See `design/tokens.json`, section "status".
 */
data class StatusPalette(
    val text: Color,
    val dot: Color,
    /** `null` means the status has no filled container. */
    val container: Color?,
    val avatarBackground: Color,
    val avatarText: Color,
)

data class AlmanaqColors(
    val available: StatusPalette,
    val offHours: StatusPalette,
    val localWeekend: StatusPalette,
    val localHoliday: StatusPalette,
    val unknown: StatusPalette,
    val accentPressed: Color,
    val textDisabled: Color,
) {
    /** Maps the API enum straight to its palette. */
    fun forStatus(status: String): StatusPalette = when (status) {
        "AVAILABLE" -> available
        "OFF_HOURS" -> offHours
        "LOCAL_WEEKEND" -> localWeekend
        "LOCAL_HOLIDAY" -> localHoliday
        else -> unknown
    }
}

/**
 * CONTRAST WARNING, unresolved as of 2026-08-29.
 *
 * `OFF_HOURS` and `UNKNOWN` use `#9C9DB4` as their text colour in the light theme,
 * which is what `design/tokens.json` says. Measured against white surface it gives
 * **2.66:1**, below the 4.5:1 that PLAN.md section 6 rule 4 requires of every text and
 * background pair. The token file contradicts its own rule.
 *
 * The values are transcribed faithfully rather than silently corrected, because the
 * palette is the human's call. Nothing renders status text yet, so nothing violates
 * the rule today. Before the "Now" screen paints a status label, either the token
 * changes or these two statuses use `Slate` (`#5B5C74`, 6.51:1) in the light theme.
 */
private val LightStatuses = AlmanaqColors(
    available = StatusPalette(Green600, Green600, Green100, Green100, Green600),
    offHours = StatusPalette(SlateLight, DotNeutralLight, null, Vesper050, Vesper500),
    localWeekend = StatusPalette(Meridian600, Meridian500, Meridian100, Vesper050, Vesper500),
    localHoliday = StatusPalette(Meridian600, Meridian500, Meridian100, Vesper050, Vesper500),
    unknown = StatusPalette(SlateLight, DotNeutralLight, null, Vesper050, Vesper500),
    accentPressed = Vesper600,
    textDisabled = SlateLight,
)

private val DarkStatuses = AlmanaqColors(
    available = StatusPalette(Green400, Green400, GreenDark, GreenDark, Green400),
    offHours = StatusPalette(SlateLight, TextDisabledDark, null, AccentSubtleDark, Vesper200),
    localWeekend = StatusPalette(Meridian400, Meridian400, AmberContainerDark, AccentSubtleDark, Vesper200),
    localHoliday = StatusPalette(Meridian400, Meridian400, AmberContainerDark, AccentSubtleDark, Vesper200),
    unknown = StatusPalette(SlateLight, TextDisabledDark, null, AccentSubtleDark, Vesper200),
    accentPressed = Vesper200,
    textDisabled = TextDisabledDark,
)

private val LocalAlmanaqColors = staticCompositionLocalOf { LightStatuses }

object AlmanaqTheme {
    val colors: AlmanaqColors
        @Composable
        @ReadOnlyComposable
        get() = LocalAlmanaqColors.current
}

@Composable
fun AlmanaqTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColors else LightColors
    val statuses = if (darkTheme) DarkStatuses else LightStatuses

    CompositionLocalProvider(LocalAlmanaqColors provides statuses) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = AlmanaqTypography,
            shapes = AlmanaqShapes,
            content = content,
        )
    }
}
