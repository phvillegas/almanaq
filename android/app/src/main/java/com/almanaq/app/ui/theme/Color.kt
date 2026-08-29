package com.almanaq.app.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Raw palette, transcribed from `design/tokens.json`, which is the single source of
 * truth. The hex values are identical on iOS and Android; only how they are applied
 * changes. See PLAN.md section 6.
 *
 * Nothing outside this file should hold a literal colour.
 */

// Vesper — indigo. Action and brand.
val Vesper700 = Color(0xFF302683)
val Vesper600 = Color(0xFF3A2DA8)
val Vesper500 = Color(0xFF4436C7)
val Vesper300 = Color(0xFF8B7DFF)
val Vesper200 = Color(0xFFB9AEFF)
val Vesper100 = Color(0xFFDEDAF6)
val Vesper050 = Color(0xFFE7E5F8)

// Meridian — saffron. Accent and alert.
val Meridian600 = Color(0xFF8A5A0B)
val Meridian500 = Color(0xFFE0A03A)
val Meridian400 = Color(0xFFF0B455)
val Meridian100 = Color(0xFFFBF0DC)

// Neutrals.
val Paper = Color(0xFFF7F7FA)
val Mist = Color(0xFFE4E4EC)
val SlateLight = Color(0xFF9C9DB4)
val Slate = Color(0xFF5B5C74)
val Nocturne = Color(0xFF171634)
val SurfaceDark = Color(0xFF1A1930)
val SurfaceDarkTonal = Color(0xFF1F1E38)
val Void = Color(0xFF0F0E1C)
val BorderDark = Color(0xFF2A2947)
val Starlight = Color(0xFFF2F2F7)

// Green — the available status.
val Green600 = Color(0xFF17724E)
val Green400 = Color(0xFF3DBE8B)
val Green100 = Color(0xFFE3F3EB)
val GreenDark = Color(0xFF12291F)

// Theme tokens that have no palette entry of their own.
val SurfaceTonalLight = Color(0xFFEAEAF2)
val TextDisabledDark = Color(0xFF6E6F87)
val AccentSubtleDark = Color(0xFF2A2456)
val AmberContainerDark = Color(0xFF2A2216)
val DotNeutralLight = Color(0xFFB9BACB)

/**
 * Text colour for a filled Vesper300 surface in the dark theme.
 *
 * White on that violet gives 3.2:1 and fails AA. This is rule 2 of PLAN.md section 6,
 * and it is the reason `onPrimary` is not simply white in both themes.
 */
val OnAccentDark = Color(0xFF0E1420)
