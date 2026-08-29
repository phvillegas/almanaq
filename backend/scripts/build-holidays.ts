/**
 * Generates `src/data/holidays/<COUNTRY>.json` from the holiday providers.
 *
 * Run ONCE A YEAR, by hand, and commit the resulting JSON. At runtime the server makes
 * no network calls at all. See PLAN.md section 5.
 *
 *   npm run build:holidays              # current year and the next one
 *   npm run build:holidays -- 2027 2028 # explicit years
 *
 * Fails loudly (exit code 1) when a target country comes back empty from every source.
 * A silently incomplete JSON is worse than a missing file: with no file the backend
 * answers UNKNOWN, which is honest.
 *
 * THREE SOURCES, TRIED IN ORDER. The order is not arbitrary — see the note at the end
 * of this file. Each country's file records which one produced it.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Holidays from 'date-holidays';

const NAGER_BASE = 'https://date.nager.at/api/v3';
const ICS_BASE = 'https://calendar.google.com/calendar/ical';

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
 * Countries no source covers, checked on 2026-08-29.
 *
 * They produce no file and do not break the script: they are reported and their
 * members fall back to UNKNOWN. Declared by hand rather than inferred, so that a
 * country gaining coverage shows up as a message instead of passing unnoticed.
 */
const KNOWN_MISSING: readonly string[] = ['PS'];

type ProviderName = 'nager.date' | 'date-holidays' | 'google-ical';

interface StoredHoliday {
  readonly date: string;
  readonly name: string;
  readonly localName: string | null;
}

interface Outcome {
  readonly holidays: readonly StoredHoliday[];
  readonly provider: ProviderName;
}

async function main(): Promise<void> {
  const years = readYears();
  const directory = join(packageRoot(), 'src', 'data', 'holidays');
  mkdirSync(directory, { recursive: true });

  const nagerCountries = await availableFromNager();
  const failures: string[] = [];
  const skipped: string[] = [];
  const recovered: string[] = [];
  const byProvider = new Map<ProviderName, number>();

  console.log(`Years ${years.join(', ')} — ${TARGET_COUNTRIES.length} target countries\n`);

  for (const country of TARGET_COUNTRIES) {
    const outcome = await resolveCountry(country, years, nagerCountries);

    if (!outcome && KNOWN_MISSING.includes(country)) {
      skipped.push(country);
      continue;
    }
    if (!outcome) {
      failures.push(`${country}: no source returned holidays`);
      continue;
    }
    if (KNOWN_MISSING.includes(country)) recovered.push(country);

    writeCountry(directory, country, years, outcome);
    byProvider.set(outcome.provider, (byProvider.get(outcome.provider) ?? 0) + 1);
    console.log(
      `  ${country}  ${String(outcome.holidays.length).padStart(3)} holidays  ${outcome.provider}`,
    );
  }

  report(byProvider, skipped, recovered);

  if (failures.length === 0) return;

  console.error(`\nFAILED. ${failures.length} country(ies) without usable data:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error('\nNo file was written for those countries.');
  process.exit(1);
}

/** Tries each source in precedence order and returns the first with data. */
async function resolveCountry(
  country: string,
  years: readonly number[],
  nagerCountries: Set<string>,
): Promise<Outcome | null> {
  const fromNager = nagerCountries.has(country) ? await fetchFromNager(country, years) : [];
  if (fromNager.length > 0) return { holidays: fromNager, provider: 'nager.date' };

  const fromDataset = fromDateHolidays(country, years);
  if (fromDataset.length > 0) return { holidays: fromDataset, provider: 'date-holidays' };

  const fromCalendar = await fetchFromGoogle(country, years);
  if (fromCalendar.length > 0) return { holidays: fromCalendar, provider: 'google-ical' };

  return null;
}

// --- Source 1: Nager.Date -----------------------------------------------------------

async function availableFromNager(): Promise<Set<string>> {
  const response = await fetch(`${NAGER_BASE}/AvailableCountries`);
  if (!response.ok) throw new Error(`AvailableCountries returned ${response.status}`);
  const countries = (await response.json()) as { countryCode: string }[];
  return new Set(countries.map((country) => country.countryCode.toUpperCase()));
}

async function fetchFromNager(
  country: string,
  years: readonly number[],
): Promise<StoredHoliday[]> {
  const collected: StoredHoliday[] = [];

  for (const year of years) {
    const response = await fetch(`${NAGER_BASE}/PublicHolidays/${year}/${country}`);
    if (!response.ok) throw new Error(`${country} ${year} returned ${response.status}`);
    const raw = (await response.json()) as {
      date: string;
      name: string;
      localName: string | null;
      global?: boolean;
    }[];

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

  return sorted(collected);
}

// --- Source 2: date-holidays (offline dataset) --------------------------------------

function fromDateHolidays(country: string, years: readonly number[]): StoredHoliday[] {
  const english = new Holidays(country, { languages: ['en'] });
  const native = new Holidays(country);
  const collected: StoredHoliday[] = [];

  for (const year of years) {
    const localNames = new Map<string, string>();
    for (const entry of native.getHolidays(year) || []) {
      localNames.set(entry.date.slice(0, 10), entry.name);
    }

    for (const entry of english.getHolidays(year) || []) {
      if (entry.type !== 'public') continue;
      const date = entry.date.slice(0, 10);
      collected.push({
        date,
        name: entry.name,
        localName: localNames.get(date) ?? null,
      });
    }
  }

  return sorted(collected);
}

// --- Source 3: Google public holiday calendars --------------------------------------

/**
 * Reads the public ICS feed Google publishes per country.
 *
 * The feed mixes real public holidays with observances, and marks which is which in
 * `DESCRIPTION`. Only the former count: marking somebody unavailable for an
 * observance would be exactly the wrong data.
 */
async function fetchFromGoogle(
  country: string,
  years: readonly number[],
): Promise<StoredHoliday[]> {
  const calendar = `en.${country.toLowerCase()}%23holiday%40group.v.calendar.google.com`;
  const response = await fetch(`${ICS_BASE}/${calendar}/public/basic.ics`);
  if (!response.ok) return [];

  const wanted = new Set(years.map(String));
  const collected: StoredHoliday[] = [];

  for (const event of parseEvents(unfold(await response.text()))) {
    if (!event.isPublicHoliday) continue;
    if (!wanted.has(event.date.slice(0, 4))) continue;
    collected.push({ date: event.date, name: event.name, localName: null });
  }

  return sorted(collected);
}

/** ICS folds long lines by continuing them with a leading space or tab. */
function unfold(text: string): string[] {
  return text.replace(/\r\n[ \t]/g, '').split(/\r?\n/);
}

interface CalendarEvent {
  readonly date: string;
  readonly name: string;
  readonly isPublicHoliday: boolean;
}

function parseEvents(lines: readonly string[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  let date = '';
  let name = '';
  let isPublicHoliday = false;

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      date = '';
      name = '';
      isPublicHoliday = false;
      continue;
    }
    if (line.startsWith('DTSTART;VALUE=DATE:')) {
      const raw = line.slice('DTSTART;VALUE=DATE:'.length).trim();
      date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      continue;
    }
    if (line.startsWith('SUMMARY:')) {
      name = line.slice('SUMMARY:'.length).replace(/\\([,;\\])/g, '$1').trim();
      continue;
    }
    if (line.startsWith('DESCRIPTION:Public holiday')) {
      isPublicHoliday = true;
      continue;
    }
    if (!line.startsWith('END:VEVENT')) continue;
    if (date === '' || name === '') continue;
    events.push({ date, name, isPublicHoliday });
  }

  return events;
}

// --- Output -------------------------------------------------------------------------

function writeCountry(
  directory: string,
  country: string,
  years: readonly number[],
  outcome: Outcome,
): void {
  const contents = {
    countryCode: country,
    provider: outcome.provider,
    generatedAt: new Date().toISOString(),
    years,
    holidays: outcome.holidays,
  };
  writeFileSync(
    join(directory, `${country}.json`),
    `${JSON.stringify(contents, null, 2)}\n`,
    'utf8',
  );
}

function report(
  byProvider: Map<ProviderName, number>,
  skipped: readonly string[],
  recovered: readonly string[],
): void {
  const total = [...byProvider.values()].reduce((sum, count) => sum + count, 0);
  console.log(`\nFiles written: ${total}`);
  for (const [provider, count] of byProvider) console.log(`  ${provider}: ${count}`);

  if (skipped.length > 0) {
    console.log(`\nNo source covers ${skipped.join(' ')}. They stay UNKNOWN.`);
  }
  if (recovered.length === 0) return;
  console.log(`\nHEADS UP: ${recovered.join(' ')} now has a source. Remove from KNOWN_MISSING.`);
}

function sorted(holidays: StoredHoliday[]): StoredHoliday[] {
  const seen = new Set<string>();
  return holidays
    .filter((holiday) => {
      const key = `${holiday.date}|${holiday.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
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
 * WHY THIS PRECEDENCE ORDER (2026-08-29)
 *
 * Nager.Date first, because its data was checked against ICU and held up. It covers
 * 57 of the 75 target countries and misses almost exactly the ones with non-standard
 * work weeks — the problem Almanaq exists to solve.
 *
 * date-holidays second. It is an offline dataset covering 63 countries, including
 * Israel, Saudi Arabia, the UAE, Iran, India, Thailand, Malaysia, Pakistan and Brunei,
 * which Nager.Date does not. It is second and not first because it is not always
 * right: it places Ethiopian Christmas (Genna) on 2026-01-06, and ICU puts Tahsas 29
 * on 2026-01-07, which is where Nager.Date also puts it. One wrong date is enough to
 * keep a source from overriding one that has been verified.
 *
 * Google's public ICS feeds last. They cover the eleven countries the other two miss
 * except Palestine, and they separate public holidays from observances. They are an
 * undocumented endpoint with no support commitment, which is survivable because this
 * runs once a year and the result is committed: an outage delays a regeneration
 * instead of breaking production.
 *
 * Only Palestine is left without a source.
 */
