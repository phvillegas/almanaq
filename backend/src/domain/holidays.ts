/**
 * Reads the precomputed holidays in `src/data/holidays/*.json`.
 *
 * No network calls at runtime: the JSON files are generated once a year with
 * `npm run build:holidays` and committed to the repository. See PLAN.md section 5.
 *
 * Coverage is per country AND per year. A country whose file exists but does not
 * include the year being asked about is NOT covered for that date: claiming "not a
 * holiday" from a file that does not reach that far would be making data up. See
 * PLAN.md section 10, rule 3.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Holiday {
  /** Local Gregorian date, "YYYY-MM-DD". */
  readonly date: string;
  /** Name in the provider's language (English in Nager.Date). */
  readonly name: string;
  /** Name in the country's own language. `null` when the provider omits it. */
  readonly localName: string | null;
}

export interface HolidayFile {
  readonly countryCode: string;
  readonly provider: string;
  readonly generatedAt: string;
  readonly years: readonly number[];
  readonly holidays: readonly Holiday[];
}

let cache: Map<string, HolidayFile> | null = null;

/**
 * Locates `src/data/holidays` by walking up to the package root.
 *
 * It walks up instead of resolving relative to the module because the same code runs
 * from `src/` under tsx and from `dist/` once compiled, while the JSON always lives in
 * `src/`: it is versioned data, not a build artifact.
 */
function dataDirectory(): string {
  let current = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    try {
      readFileSync(join(current, 'package.json'), 'utf8');
      return join(current, 'src', 'data', 'holidays');
    } catch {
      current = dirname(current);
    }
  }
  throw new Error('Could not find the package root to locate src/data/holidays');
}

function load(): Map<string, HolidayFile> {
  if (cache) return cache;

  const byCountry = new Map<string, HolidayFile>();
  const directory = dataDirectory();
  const files = listJsonFiles(directory);

  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(directory, file), 'utf8')) as HolidayFile;
    const code = raw.countryCode?.toUpperCase();
    if (!code) continue;
    byCountry.set(code, {
      ...raw,
      countryCode: code,
      holidays: [...raw.holidays].sort((a, b) => a.date.localeCompare(b.date)),
    });
  }

  cache = byCountry;
  return cache;
}

function listJsonFiles(directory: string): string[] {
  try {
    return readdirSync(directory).filter((file) => file.endsWith('.json'));
  } catch {
    // With no data directory no country is covered: everything falls back to UNKNOWN.
    return [];
  }
}

/** Clears the cache. Tests only. */
export function resetCache(): void {
  cache = null;
}

export function coveredCountries(): string[] {
  return [...load().keys()].sort();
}

/**
 * Do we have holidays for that country on that date?
 *
 * `isoDate` is the member's LOCAL date ("YYYY-MM-DD"), not the server's.
 */
export function hasCoverage(countryCode: string | null | undefined, isoDate: string): boolean {
  const file = fileFor(countryCode);
  if (!file) return false;
  return file.years.includes(Number(isoDate.slice(0, 4)));
}

/**
 * The holiday falling on that local date, or `null`.
 *
 * `null` only means "not a holiday" when `hasCoverage` returned `true`. Without
 * coverage it means "we do not know".
 *
 * KNOWN PITFALL, not implemented in v1: in the Hebrew and Hijri calendars the day
 * starts at sunset, so a holiday actually begins the afternoon before the Gregorian
 * date recorded here. See PLAN.md section 5, pitfall 1.
 */
export function holidayOn(
  countryCode: string | null | undefined,
  isoDate: string,
): Holiday | null {
  const file = fileFor(countryCode);
  if (!file) return null;
  return file.holidays.find((holiday) => holiday.date === isoDate) ?? null;
}

/**
 * Upcoming holidays from a local date, inclusive.
 * The detail screen shows at most 3. See PLAN.md section 7.3.
 */
export function upcomingHolidays(
  countryCode: string | null | undefined,
  fromIsoDate: string,
  limit = 3,
): Holiday[] {
  const file = fileFor(countryCode);
  if (!file) return [];
  return file.holidays.filter((holiday) => holiday.date >= fromIsoDate).slice(0, limit);
}

function fileFor(countryCode: string | null | undefined): HolidayFile | null {
  if (typeof countryCode !== 'string') return null;
  return load().get(countryCode.trim().toUpperCase()) ?? null;
}
