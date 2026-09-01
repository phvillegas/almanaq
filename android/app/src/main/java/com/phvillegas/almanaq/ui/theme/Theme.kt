package com.phvillegas.almanaq.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * The Sol y Luna theme.
 *
 * The Material role scheme is **generated**, not written here. It lives in
 * `Material3Colors.kt`, produced by `backend/scripts/build-theme.ts` from the `#4436C7`
 * seed, and this file only chooses between light and dark. Section 8 of the plan asked
 * for that generation from the start; it used to be a hand-mapped scheme instead, which
 * left eleven roles unset for Material to fill from its own baseline.
 *
 * Dynamic colour is deliberately absent: Material You would repaint the brand violet
 * from the user's wallpaper. Section 8 requires it off, so nothing here or in the
 * generated file ever reads `dynamicLightColorScheme`.
 *
 * What stays hand-written is below: the availability statuses, which are product meaning
 * rather than theme roles and which Material has no slot for.
 */

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
 * `OFF_HOURS` and `UNKNOWN` take `Slate` and not `SlateLight` for their text.
 * `SlateLight` on a white surface measures 2.66:1, below the 4.5:1 rule. The token
 * file was corrected on 2026-08-29; see the note under the status table in PLAN.md
 * section 6.
 */
private val LightStatuses = AlmanaqColors(
    available = StatusPalette(Green600, Green600, Green100, Green100, Green600),
    offHours = StatusPalette(Slate, DotNeutralLight, null, Vesper050, Vesper500),
    localWeekend = StatusPalette(Meridian600, Meridian500, Meridian100, Vesper050, Vesper500),
    localHoliday = StatusPalette(Meridian600, Meridian500, Meridian100, Vesper050, Vesper500),
    unknown = StatusPalette(Slate, DotNeutralLight, null, Vesper050, Vesper500),
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
    val colorScheme = materialScheme(darkTheme)
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
