package com.phvillegas.almanaq.ui.theme

import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Typography and shapes, from `design/tokens.json`.
 *
 * The system font, Roboto, on purpose: PLAN.md section 6 rules out bundling fonts in
 * v1. Sizes are in sp so Dynamic Type scaling keeps working.
 *
 * The six roles from the token file are mapped onto the Material 3 slots the screens
 * actually use, rather than filling in all fifteen.
 */
val AlmanaqTypography = Typography(
    // display — 46/52, weight 700. The large local time on the detail screen.
    displayLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = 46.sp,
        lineHeight = 52.sp,
        letterSpacing = (-1).sp,
    ),
    // title — 26/32, weight 700. Screen titles.
    headlineMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = 26.sp,
        lineHeight = 32.sp,
        letterSpacing = (-0.5).sp,
    ),
    // heading — 19/26, weight 600.
    titleMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = 19.sp,
        lineHeight = 26.sp,
        letterSpacing = 0.sp,
    ),
    // body — 15/22, weight 400.
    bodyMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 22.sp,
        letterSpacing = 0.sp,
    ),
    // label — 13/18, weight 500.
    labelLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 13.sp,
        lineHeight = 18.sp,
        letterSpacing = 0.sp,
    ),
    // caption — 11/16, weight 600, tracking 1.6, uppercase. Section headers.
    labelSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = 11.sp,
        lineHeight = 16.sp,
        letterSpacing = 1.6.sp,
    ),
)

/**
 * Local times and counters must use tabular figures, otherwise the digits jump every
 * time the clock refreshes. PLAN.md section 6.
 *
 * Roboto exposes tabular numerals through the `tnum` OpenType feature.
 */
val TabularFigures = TextStyle(fontFeatureSettings = "tnum")

/**
 * Android radii are 18-20, against 12-14 on iOS. Same palette, different application:
 * PLAN.md section 8.
 */
val AlmanaqShapes = Shapes(
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(18.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(28.dp),
)
