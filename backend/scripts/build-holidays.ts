/**
 * Generates `src/data/holidays/<COUNTRY>.json` from the holiday provider.
 *
 * Run ONCE A YEAR, by hand, and commit the resulting JSON. At runtime the server makes
 * no network calls at all. See PLAN.md section 5.
 *
 *   npm run build:holidays              # current year and the next one
 *   npm run build:holidays -- 2027 2028 # explicit years
 *
 * Fails loudly (exit code 1) when a target country comes back empty or errors out. A
 * silently incomplete JSON is worse than a missing file: with no file the backend
 * answers UNKNOWN, which is honest.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROVIDER = 'nager.date';
const BASE = 'https://date.nager.at/api/v3';

/**
 * Countries we want holidays for.
 *
 * Covers every country in the work week table (`src/data/workweeks.ts`) plus the usual
 * destinations of distributed teams. Adding a country here is free; removing one makes
 * the backend answer UNKNOWN for its members.
 */
const TARGET_COUNTRIES: readonly string[] = [
  // Non-standard work weeks (the reason this product exists)
  'IL', 'SA', 'QA', 'KW', 'OM', 'BH', 'EG', 'JO', 'IQ', 'PS', 'LY', 'SY', 'YE',
  'BD', 'MV', 'AE', 'AF', 'IR', 'NP', 'BN',
  // Own local calendar
  'ET', 'TH', 'JP', 'IN',
  // Americas
  'AR', 'BR', 'CL', 'CO', 'MX', 'PE', 'UY', 'US', 'CA', 'CR', 'EC', 'PY', 'BO', 'VE',
  // Europe
  'ES', 'PT', 'FR', 'DE', 'IT', 'GB', 'IE', 'NL', 'BE', 'PL', 'SE', 'NO', 'DK', 'FI',
  'CH', 'AT', 'CZ', 'RO', 'GR', 'UA',
  // Rest
  'AU', 'NZ', 'ZA', 'NG', 'KE', 'MA', 'TR', 'CN', 'KR', 'SG', 'PH', 'ID', 'VN', 'MY',
  'PK', 'LB', 'RU',
];

/**
 * Countries the provider does NOT cover, checked on 2026-08-28 against
 * `GET /api/v3/AvailableCountries`.
 *
 * They produce no file and do not break the script: they are reported and their
 * members fall back to UNKNOWN. The list is declared by hand rather than read from the
 * provider on purpose — if Nager.Date starts covering one tomorrow, the script says so
 * and the entry has to come off this list.
 *
 * Note that almost all of them are countries with a non-standard work week. That is
 * the central limitation of the free provider. See the footnote at the end of the file.
 */
const KNOWN_MISSING: readonly string[] = [
  'IL', 'SA', 'QA', 'KW', 'OM', 'JO', 'PS', 'MV', 'AE', 'AF', 'IR', 'NP', 'BN',
  'TH', 'IN', 'MY', 'PK', 'LB',
];

interface ProviderHoliday {
  readonly date: string;
  readonly name: string;
  readonly localName: string | null;
  readonly types?: readonly string[];
  readonly global?: boolean;
}

interface ProviderCountry {
  readonly countryCode: string;
}

interface StoredHoliday {
  readonly date: string;
  readonly name: string;
  readonly localName: string | null;
}

async function main(): Promise<void> {
  const years = readYears();
  const directory = join(packageRoot(), 'src', 'data', 'holidays');
  mkdirSync(directory, { recursive: true });

  const available = await availableCountries();
  const failures: string[] = [];
  const skipped: string[] = [];
  const recovered: string[] = [];
  let written = 0;

  console.log(`Provider: ${PROVIDER} — years ${years.join(', ')}`);
  console.log(`Target countries: ${TARGET_COUNTRIES.length}\n`);

  for (const country of TARGET_COUNTRIES) {
    const covered = available.has(country);
    const declaredMissing = KNOWN_MISSING.includes(country);

    if (!covered && declaredMissing) {
      skipped.push(country);
      continue;
    }
    if (!covered) {
      failures.push(`${country}: the provider does not list it and it is not in KNOWN_MISSING`);
      continue;
    }
    if (declaredMissing) recovered.push(country);

    try {
      const holidays = await fetchCountry(country, years);
      if (holidays.length === 0) {
        failures.push(`${country}: the provider returned 0 holidays`);
        continue;
      }
      writeCountry(directory, country, years, holidays);
      written++;
      console.log(`  ${country}  ${String(holidays.length).padStart(3)} holidays`);
    } catch (error) {
      failures.push(`${country}: ${(error as Error).message}`);
    }
  }

  console.log(`\nFiles written: ${written}`);
  report(skipped, recovered);

  if (failures.length === 0) return;

  console.error(`\nFAILED. ${failures.length} country(ies) without usable data:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error('\nNo file was written for those countries.');
  process.exit(1);
}

function report(skipped: readonly string[], recovered: readonly string[]): void {
  if (skipped.length > 0) {
    console.log(
      `\nNot covered by the provider (${skipped.length}), they stay UNKNOWN:\n  ${skipped.join(' ')}`,
    );
  }
  if (recovered.length === 0) return;
  console.log(
    `\nHEADS UP: the provider now covers ${recovered.join(' ')}.\n  Remove them from KNOWN_MISSING.`,
  );
}

function writeCountry(
  directory: string,
  country: string,
  years: readonly number[],
  holidays: readonly StoredHoliday[],
): void {
  const contents = {
    countryCode: country,
    provider: PROVIDER,
    generatedAt: new Date().toISOString(),
    years,
    holidays,
  };
  writeFileSync(join(directory, `${country}.json`), `${JSON.stringify(contents, null, 2)}\n`, 'utf8');
}

async function availableCountries(): Promise<Set<string>> {
  const response = await fetch(`${BASE}/AvailableCountries`);
  if (!response.ok) {
    throw new Error(`AvailableCountries returned ${response.status}`);
  }
  const countries = (await response.json()) as ProviderCountry[];
  return new Set(countries.map((country) => country.countryCode.toUpperCase()));
}

async function fetchCountry(
  country: string,
  years: readonly number[],
): Promise<StoredHoliday[]> {
  const collected: StoredHoliday[] = [];

  for (const year of years) {
    const response = await fetch(`${BASE}/PublicHolidays/${year}/${country}`);
    if (!response.ok) {
      throw new Error(`${year} returned ${response.status}`);
    }
    const raw = (await response.json()) as ProviderHoliday[];

    for (const holiday of raw) {
      // National holidays only: a regional one does not mean "the country is off".
      if (holiday.global === false) continue;
      collected.push({
        date: holiday.date,
        name: holiday.name,
        localName: holiday.localName ?? null,
      });
    }
  }

  collected.sort((a, b) => a.date.localeCompare(b.date));
  return collected;
}

function readYears(): number[] {
  const args = process.argv.slice(2).filter((arg) => /^\d{4}$/.test(arg));
  if (args.length > 0) return args.map(Number);
  const current = new Date().getUTCFullYear();
  return [current, current + 1];
}

function packageRoot(): string {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

await main();

/*
 * A NOTE ON THE PROVIDER (2026-08-28)
 *
 * Nager.Date lists 204 countries but covers none of these:
 *
 *   IL SA QA KW OM JO PS MV AE AF IR NP BN TH IN MY PK LB
 *
 * That is almost exactly the set of countries with a non-standard work week, which is
 * the problem Almanaq exists to solve. Israel and Nepal are two of the four mandatory
 * test cases in PLAN.md section 9.
 *
 * Switching providers is cheap: this file changes and nothing else, because the data
 * is precomputed. See PLAN.md section 13, open decision "holiday provider".
 */
