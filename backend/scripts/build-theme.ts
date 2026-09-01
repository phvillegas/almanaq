/**
 * Regenerates the colour scheme in `design/tokens.json` from the brand seed.
 *
 * Section 8 of the plan asks for the Material 3 scheme to be generated from the
 * `#4436C7` seed rather than assembled by hand, and this is that generation. It runs at
 * design time and commits its output, exactly like the holiday and city data: there is
 * no colour maths on a device, and a change to the palette shows up in a diff.
 *
 * That last part is the whole reason this is a script and not a visit to the Material
 * Theme Builder website. A scheme pasted out of a browser is unreproducible; this one
 * can be re-run and compared.
 *
 * **Why `SchemeFidelity`.** Material offers several variants from the same seed, and
 * they are not interchangeable. Measured from `#4436C7`:
 *
 * | Variant     | `primary` | What it does to the brand           |
 * |-------------|-----------|-------------------------------------|
 * | TonalSpot   | `#5b5891` | Desaturates it into a grey lavender |
 * | Vibrant     | `#4d34ff` | Pushes it brighter than the icon    |
 * | Expressive  | `#006c4e` | Rotates the hue to green            |
 * | Fidelity    | `#2b11b1` | Keeps it, seed preserved as container |
 *
 * Expressive would give this product a green brand. TonalSpot mutes the one colour the
 * launcher icon is built from. Fidelity exists specifically to preserve the source
 * colour, and it puts `#4436C7` itself into `primaryContainer`, so the seed still
 * appears literally in the scheme.
 *
 * **Two shapes come out of one generation**, and that is deliberate. `material3` holds
 * all 36 roles for Compose. `theme` holds twelve platform-neutral names for iOS, which
 * has no notion of Material roles. Both are written from the same run, so the two
 * platforms cannot drift — which is the promise section 6 makes and the reason this is
 * not generated on the device.
 *
 * The status colours are **not** generated. Green for available and amber for a holiday
 * are product meaning, not theme roles, and Material has no slot for them. They stay as
 * designed, and this script re-checks each one against the regenerated backgrounds at
 * 4.5:1 and refuses to write if any pair fails. Rule 7 is enforced here rather than
 * remembered.
 *
 * Run with `npm run build:theme`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Hct,
  MaterialDynamicColors,
  SchemeFidelity,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities';

/** The brand violet. Changing this regenerates everything below it. */
const SEED = '#4436C7';

/** 0 is the standard Material contrast level. Higher values are the accessibility ramps. */
const CONTRAST = 0;

const M3_ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'inversePrimary',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'background', 'onBackground',
  'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant', 'surfaceTint',
  'inverseSurface', 'inverseOnSurface',
  'outline', 'outlineVariant', 'scrim',
  'surfaceBright', 'surfaceDim',
  'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer',
  'surfaceContainerHigh', 'surfaceContainerHighest',
] as const;

/**
 * The twelve names iOS reads, mapped onto the roles they correspond to.
 *
 * `accentPressed` has no Material equivalent — Material expresses pressed as a state
 * layer over `primary` rather than as its own colour — so it takes the container's
 * on-colour, which is the darker end of the same tonal ramp.
 */
const SEMANTIC: Record<string, (typeof M3_ROLES)[number]> = {
  background: 'background',
  surface: 'surface',
  surfaceTonal: 'surfaceContainer',
  textPrimary: 'onSurface',
  textSecondary: 'onSurfaceVariant',
  textDisabled: 'outline',
  textOnAccent: 'onPrimary',
  accent: 'primary',
  accentPressed: 'onPrimaryContainer',
  accentSubtle: 'primaryContainer',
  border: 'outlineVariant',
  scrim: 'scrim',
};

type Scheme = Record<string, string>;

function generate(dark: boolean): Scheme {
  const scheme = new SchemeFidelity(Hct.fromInt(argbFromHex(SEED)), dark, CONTRAST);
  const out: Scheme = {};

  for (const role of M3_ROLES) {
    const colour = (MaterialDynamicColors as Record<string, unknown>)[role];
    if (colour === undefined) {
      throw new Error(`Material no longer exposes the role "${role}"`);
    }
    out[role] = hexFromArgb((colour as { getArgb(s: unknown): number }).getArgb(scheme));
  }

  return out;
}

// --- Contrast, so rule 7 is checked rather than remembered ------------------------

function relativeLuminance(hex: string): number {
  const channel = (value: number): number => {
    const c = value / 255;
    // The 0.03928 knee is the sRGB transfer curve, not a rounding choice.
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  const n = Number.parseInt(hex.replace('#', ''), 16);
  const r = channel((n >> 16) & 0xff);
  const g = channel((n >> 8) & 0xff);
  const b = channel(n & 0xff);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Every status text colour, on every surface it can land on. */
function checkStatuses(tokens: Record<string, any>, m3: Record<string, Scheme>): string[] {
  const failures: string[] = [];

  for (const theme of ['light', 'dark'] as const) {
    const scheme = m3[theme];
    for (const [name, status] of Object.entries(tokens.status)) {
      if (name.startsWith('$')) continue;

      const entry = (status as Record<string, any>)[theme];
      if (entry?.text === undefined) continue;

      // A status with a container is read on it; one without is read on the page.
      const grounds = entry.container ? [entry.container] : [scheme.background, scheme.surface];
      for (const ground of grounds) {
        const ratio = contrast(entry.text, ground);
        if (ratio >= 4.5) continue;
        failures.push(`${theme} ${name}: ${entry.text} on ${ground} is ${ratio.toFixed(2)}:1`);
      }
    }
  }

  return failures;
}

// --- Write ------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const tokensPath = join(here, '..', '..', 'design', 'tokens.json');
const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'));

const m3 = { light: generate(false), dark: generate(true) };

const failures = checkStatuses(tokens, m3);
if (failures.length > 0) {
  console.error('Status colours fail 4.5:1 against the regenerated scheme:');
  for (const failure of failures) console.error(`  ${failure}`);
  console.error('\nNothing written. Fix the status colours or the seed, not this check.');
  process.exit(1);
}

tokens.material3 = {
  $comment:
    `Generated by scripts/build-theme.ts from the ${SEED} seed with SchemeFidelity, ` +
    'contrast level 0. Do not edit by hand: run npm run build:theme.',
  seed: SEED,
  variant: 'fidelity',
  light: m3.light,
  dark: m3.dark,
};

for (const theme of ['light', 'dark'] as const) {
  for (const [name, role] of Object.entries(SEMANTIC)) {
    tokens.theme[theme][name] = m3[theme][role];
  }
}

writeFileSync(tokensPath, `${JSON.stringify(tokens, null, 2)}\n`);

/**
 * The Compose scheme, emitted rather than transcribed.
 *
 * Seventy-two hex values copied by hand is seventy-two chances to typo one, and a wrong
 * `surfaceContainerHigh` is invisible until it is on a screen. The Kotlin comes out of
 * the same run that writes the JSON, so the two cannot disagree.
 */
function kotlin(): string {
  const scheme = (name: string, theme: Scheme): string => {
    const body = M3_ROLES.map((role) => `    ${role} = Color(0xFF${theme[role].slice(1).toUpperCase()}),`);
    return `private val ${name} = ${name.startsWith('M3Light') ? 'lightColorScheme' : 'darkColorScheme'}(\n${body.join('\n')}\n)`;
  };

  return `package com.phvillegas.almanaq.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

/**
 * GENERATED FILE — do not edit.
 *
 * Written by \`backend/scripts/build-theme.ts\` from the ${SEED} seed with SchemeFidelity
 * at contrast level 0, the same run that writes \`design/tokens.json\`. Change the seed
 * there and run \`npm run build:theme\`.
 *
 * All ${M3_ROLES.length} roles are filled. That is the point of generating them: the
 * hand-written scheme this replaced left eleven unset — \`secondaryContainer\`,
 * \`tertiary*\`, \`error*\`, \`surfaceTint\` — and Material fills a missing role from its own
 * baseline, which is a lavender that appears in no token file. It reached the screen
 * once already, as a NavigationBar painted #F3EDF7.
 */

${scheme('M3LightColors', m3.light)}

${scheme('M3DarkColors', m3.dark)}

/** The generated scheme for a theme. Dynamic colour is never consulted: PLAN.md 8. */
internal fun materialScheme(dark: Boolean): ColorScheme = if (dark) M3DarkColors else M3LightColors
`;
}

const kotlinPath = join(
  here, '..', '..', 'android', 'app', 'src', 'main', 'java',
  'com', 'phvillegas', 'almanaq', 'ui', 'theme', 'Material3Colors.kt',
);
writeFileSync(kotlinPath, kotlin());

console.log(`Wrote ${M3_ROLES.length} roles per theme from ${SEED} (fidelity).`);
console.log(`  light primary ${m3.light.primary}   background ${m3.light.background}`);
console.log(`  dark  primary ${m3.dark.primary}   background ${m3.dark.background}`);
console.log('Status colours all clear 4.5:1.');
