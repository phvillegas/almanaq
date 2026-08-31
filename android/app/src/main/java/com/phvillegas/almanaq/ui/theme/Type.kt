package com.phvillegas.almanaq.ui.theme

import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.phvillegas.almanaq.R

/**
 * Inter, bundled.
 *
 * This overrides PLAN.md section 6, which said system typography and no external fonts
 * in v1. That was reversed deliberately on 2026-08-31: the system font read wrong for
 * the product and the human made the call. The plan is updated to match rather than left
 * to contradict the code.
 *
 * **One variable file, not four static ones.** `InterVariable.ttf` is 859KB and carries
 * every weight; the four static faces we would otherwise need are about 410KB each,
 * so the variable font is roughly half the size and any future weight is free.
 *
 * **Not subset**, which is the expensive-looking decision here. Inter ships Cyrillic,
 * Greek, Vietnamese and more, and cutting it to Latin would save several hundred
 * kilobytes. It stays whole because this app exists to show city and holiday names from
 * countries nobody on the team thought about, and a missing glyph is a tofu box in
 * exactly those places. Rule 3 is about invented data, but the same instinct applies:
 * a visible failure in the countries this product is for is not worth 300KB.
 *
 * `opsz` is left at its default. Only `wght` is pinned, per weight.
 */
val Inter = FontFamily(
    Font(R.font.inter_variable, FontWeight.Normal, variationSettings = weight(400)),
    Font(R.font.inter_variable, FontWeight.Medium, variationSettings = weight(500)),
    Font(R.font.inter_variable, FontWeight.SemiBold, variationSettings = weight(600)),
    Font(R.font.inter_variable, FontWeight.Bold, variationSettings = weight(700)),
)

private fun weight(value: Int) = FontVariation.Settings(FontVariation.weight(value))

/**
 * The type scale, from `design/tokens.json`.
 *
 * Sizes are in sp so font scaling keeps working — the detail rows are laid out to
 * survive 200%, and that was verified rather than assumed.
 *
 * The six roles from the token file are mapped onto the Material 3 slots the screens
 * actually use, rather than filling in all fifteen. The tracking values, including the
 * negative ones on display and title, come from the token file too.
 */
val AlmanaqTypography = Typography(
    // display — 46/52, weight 700. The large local time on the detail screen.
    displayLarge = TextStyle(
        fontFamily = Inter,
        fontWeight = FontWeight.Bold,
        fontSize = 46.sp,
        lineHeight = 52.sp,
        letterSpacing = (-1).sp,
    ),
    // title — 26/32, weight 700. Screen titles.
    headlineMedium = TextStyle(
        fontFamily = Inter,
        fontWeight = FontWeight.Bold,
        fontSize = 26.sp,
        lineHeight = 32.sp,
        letterSpacing = (-0.5).sp,
    ),
    // heading — 19/26, weight 600.
    titleMedium = TextStyle(
        fontFamily = Inter,
        fontWeight = FontWeight.SemiBold,
        fontSize = 19.sp,
        lineHeight = 26.sp,
        letterSpacing = 0.sp,
    ),
    // body — 15/22, weight 400.
    bodyMedium = TextStyle(
        fontFamily = Inter,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 22.sp,
        letterSpacing = 0.sp,
    ),
    // label — 13/18, weight 500.
    labelLarge = TextStyle(
        fontFamily = Inter,
        fontWeight = FontWeight.Medium,
        fontSize = 13.sp,
        lineHeight = 18.sp,
        letterSpacing = 0.sp,
    ),
    // caption — 11/16, weight 600, tracking 1.6, uppercase. Section headers.
    labelSmall = TextStyle(
        fontFamily = Inter,
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
 * Inter exposes tabular numerals through the `tnum` OpenType feature, same as Roboto
 * did, so swapping the family did not cost this.
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
