package com.phvillegas.almanaq.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

/**
 * GENERATED FILE — do not edit.
 *
 * Written by `backend/scripts/build-theme.ts` from the #4436C7 seed with SchemeFidelity
 * at contrast level 0, the same run that writes `design/tokens.json`. Change the seed
 * there and run `npm run build:theme`.
 *
 * All 36 roles are filled. That is the point of generating them: the
 * hand-written scheme this replaced left eleven unset — `secondaryContainer`,
 * `tertiary*`, `error*`, `surfaceTint` — and Material fills a missing role from its own
 * baseline, which is a lavender that appears in no token file. It reached the screen
 * once already, as a NavigationBar painted #F3EDF7.
 */

private val M3LightColors = lightColorScheme(
    primary = Color(0xFF2B11B1),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFF4436C7),
    onPrimaryContainer = Color(0xFFC0BBFF),
    inversePrimary = Color(0xFFC4C0FF),
    secondary = Color(0xFF5B5892),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFC1BDFF),
    onSecondaryContainer = Color(0xFF4D4A83),
    tertiary = Color(0xFF672400),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFF8C3400),
    onTertiaryContainer = Color(0xFFFFB08E),
    error = Color(0xFFBA1A1A),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF93000A),
    background = Color(0xFFFCF8FF),
    onBackground = Color(0xFF1B1B23),
    surface = Color(0xFFFCF8FF),
    onSurface = Color(0xFF1B1B23),
    surfaceVariant = Color(0xFFE4E0F3),
    onSurfaceVariant = Color(0xFF474554),
    surfaceTint = Color(0xFF5347D6),
    inverseSurface = Color(0xFF302F38),
    inverseOnSurface = Color(0xFFF3EFFB),
    outline = Color(0xFF777586),
    outlineVariant = Color(0xFFC8C4D7),
    scrim = Color(0xFF000000),
    surfaceBright = Color(0xFFFCF8FF),
    surfaceDim = Color(0xFFDCD8E4),
    surfaceContainerLowest = Color(0xFFFFFFFF),
    surfaceContainerLow = Color(0xFFF6F2FE),
    surfaceContainer = Color(0xFFF0ECF8),
    surfaceContainerHigh = Color(0xFFEAE6F3),
    surfaceContainerHighest = Color(0xFFE5E1ED),
)

private val M3DarkColors = darkColorScheme(
    primary = Color(0xFFC4C0FF),
    onPrimary = Color(0xFF2200A3),
    primaryContainer = Color(0xFF4436C7),
    onPrimaryContainer = Color(0xFFC0BBFF),
    inversePrimary = Color(0xFF5347D6),
    secondary = Color(0xFFC4C0FF),
    onSecondary = Color(0xFF2C2961),
    secondaryContainer = Color(0xFF434079),
    onSecondaryContainer = Color(0xFFB2AEEF),
    tertiary = Color(0xFFFFB596),
    onTertiary = Color(0xFF581E00),
    tertiaryContainer = Color(0xFF8C3400),
    onTertiaryContainer = Color(0xFFFFB08E),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
    background = Color(0xFF13121B),
    onBackground = Color(0xFFE5E1ED),
    surface = Color(0xFF13121B),
    onSurface = Color(0xFFE5E1ED),
    surfaceVariant = Color(0xFF474554),
    onSurfaceVariant = Color(0xFFC8C4D7),
    surfaceTint = Color(0xFFC4C0FF),
    inverseSurface = Color(0xFFE5E1ED),
    inverseOnSurface = Color(0xFF302F38),
    outline = Color(0xFF918FA0),
    outlineVariant = Color(0xFF474554),
    scrim = Color(0xFF000000),
    surfaceBright = Color(0xFF393841),
    surfaceDim = Color(0xFF13121B),
    surfaceContainerLowest = Color(0xFF0E0D15),
    surfaceContainerLow = Color(0xFF1B1B23),
    surfaceContainer = Color(0xFF1F1F27),
    surfaceContainerHigh = Color(0xFF2A2932),
    surfaceContainerHighest = Color(0xFF35343D),
)

/** The generated scheme for a theme. Dynamic colour is never consulted: PLAN.md 8. */
internal fun materialScheme(dark: Boolean): ColorScheme = if (dark) M3DarkColors else M3LightColors
