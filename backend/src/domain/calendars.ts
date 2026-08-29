/**
 * Conversion of a UTC instant into a member's local reality: time, date, weekday,
 * offset and local calendar.
 *
 * Everything goes through `Intl` (Node's native ICU). No hand-rolled date arithmetic.
 *
 * HARD RULE: no function in this module formats without an explicit `timeZone`.
 * Without it ICU uses the process time zone and the date shifts by a day on any
 * server whose offset differs from the member's. The verification snippet in
 * SETUP.md section 2 has exactly that bug: `new Date('2026-08-17')` is midnight UTC,
 * and formatted in a negative offset it renders as the 16th.
 *
 * Labels and notes are not here: they are product text and live in `i18n.ts`.
 *
 * Documented on 2026-08-28.
 */

import { intlTag, messagesFor, type Locale } from './i18n.js';

/** ICU calendar systems in use. See PLAN.md section 5. */
export type CalendarSystem =
  | 'hebrew'
  | 'ethiopic'
  | 'persian'
  | 'islamic-umalqura'
  | 'buddhist'
  | 'indian'
  | 'japanese';

export interface LocalCalendar {
  readonly system: CalendarSystem;
  readonly label: string;
  /** Local year, already formatted. May include an era, as in the Japanese calendar. */
  readonly currentYear: string;
  /** Nuance that changes how dates should be read. `null` when there is nothing to add. */
  readonly note: string | null;
}

export interface LocalParts {
  /** "18:42", 24-hour. */
  readonly localTime: string;
  /** "2026-08-21", local Gregorian date. */
  readonly localDate: string;
  readonly localWeekday: LocalWeekday;
  readonly utcOffsetMinutes: number;
}

export type LocalWeekday =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

interface CalendarEntry {
  readonly system: CalendarSystem;
  readonly source: string;
  readonly verified: string;
}

/**
 * Countries with their own local calendar that ICU can convert.
 *
 * Entry criterion: the calendar has civil or official use in the country, not just
 * religious use. A country not listed here shows the Gregorian calendar only.
 *
 * Deliberately EXCLUDED:
 *
 * - NP (Bikram Sambat) and BD (Bengali): ICU does not ship them. PLAN.md section 5
 *   lists them as known gaps. Return `null` rather than approximate with another system.
 * - CN, TW, KR, VN: the civil calendar is Gregorian and the lunar one only governs
 *   holidays. ICU also formats them without month names in most locales, so the label
 *   would be useless. And they are three distinct systems sharing an origin: merging
 *   them would produce wrong dates. See PLAN.md section 5, pitfall 3.
 */
const CALENDARS_BY_COUNTRY: Readonly<Record<string, CalendarEntry>> = {
  IL: {
    system: 'hebrew',
    source: 'https://www.gov.il/en/departments/topics/jewish_holidays',
    verified: '2026-08-28',
  },
  ET: {
    system: 'ethiopic',
    source: 'https://www.ethiopianembassy.org/',
    verified: '2026-08-28',
  },
  IR: {
    system: 'persian',
    source: 'https://www.timeanddate.com/calendar/persian-calendar.html',
    verified: '2026-08-28',
  },
  AF: {
    system: 'persian',
    source: 'https://www.timeanddate.com/calendar/persian-calendar.html',
    verified: '2026-08-28',
  },
  SA: {
    system: 'islamic-umalqura',
    source: 'https://www.ummulqura.org.sa/',
    verified: '2026-08-28',
  },
  TH: {
    system: 'buddhist',
    source: 'https://www.thaiembassy.com/',
    verified: '2026-08-28',
  },
  JP: {
    system: 'japanese',
    source: 'https://www.japan.go.jp/',
    verified: '2026-08-28',
  },
  IN: {
    system: 'indian',
    source: 'https://www.india.gov.in/',
    verified: '2026-08-28',
  },
};

const WEEKDAY_NAMES: readonly LocalWeekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/** Is this an IANA time zone identifier this runtime knows? */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a UTC instant into the member's local parts.
 *
 * Locale-independent on purpose: these are machine values, not display text. The
 * formatting locale is fixed to `en-US` so the parts stay parseable.
 *
 * Throws on an unknown time zone: that is a client data error, not something to
 * paper over with a default.
 */
export function localParts(instant: Date, timeZone: string): LocalParts {
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError(`Unknown time zone: ${timeZone}`);
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    calendar: 'gregory',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const find = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  const year = find('year').padStart(4, '0');
  const month = find('month');
  const day = find('day');
  const hour = find('hour');
  const minute = find('minute');
  const weekday = find('weekday').toLowerCase() as LocalWeekday;

  return {
    localTime: `${hour}:${minute}`,
    localDate: `${year}-${month}-${day}`,
    localWeekday: WEEKDAY_NAMES.includes(weekday) ? weekday : 'monday',
    utcOffsetMinutes: offsetInMinutes(instant, timeZone),
  };
}

/**
 * Time zone offset from UTC, in minutes, for that instant.
 *
 * Computed per instant rather than per zone because the offset changes with daylight
 * saving time. See PLAN.md section 5, pitfall 4.
 */
export function offsetInMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(instant);

  const text = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(text);
  if (!match) return 0; // A bare "GMT" means UTC.

  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** Long local date, without the year: "viernes, 21 de agosto" / "Friday, August 21". */
export function formatLongDate(instant: Date, timeZone: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlTag(locale), {
    timeZone,
    calendar: 'gregory',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(instant);
}

/** Date without weekday: "21 de agosto" / "August 21". Used for holiday dates. */
export function formatShortDate(instant: Date, timeZone: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlTag(locale), {
    timeZone,
    calendar: 'gregory',
    month: 'long',
    day: 'numeric',
  }).format(instant);
}

/**
 * The country's local calendar, with the year resolved for that instant.
 *
 * Returns `null` when the country has no calendar of its own or ICU does not cover
 * it. The client hides the whole row. Do not invent conversions: PLAN.md section 5.
 */
export function getLocalCalendar(
  countryCode: string | null | undefined,
  instant: Date,
  timeZone: string,
  locale: Locale,
): LocalCalendar | null {
  const code = typeof countryCode === 'string' ? countryCode.trim().toUpperCase() : '';
  const entry = CALENDARS_BY_COUNTRY[code];
  if (!entry) return null;
  if (!isValidTimeZone(timeZone)) return null;

  const messages = messagesFor(locale);
  return {
    system: entry.system,
    label: messages.calendarLabel[entry.system],
    currentYear: localYear(instant, timeZone, entry.system, locale),
    note: messages.calendarNote[entry.system],
  };
}

/**
 * Year in the given calendar. Includes the era when it carries meaning ("Reiwa 8"):
 * without it the Japanese year is a bare number that says nothing.
 */
export function localYear(
  instant: Date,
  timeZone: string,
  system: CalendarSystem,
  locale: Locale,
): string {
  const parts = new Intl.DateTimeFormat(`${intlTag(locale)}-u-ca-${system}`, {
    timeZone,
    year: 'numeric',
    era: 'short',
  }).formatToParts(instant);

  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  if (system !== 'japanese') return year;

  const era = parts.find((part) => part.type === 'era')?.value ?? '';
  if (!era) return year;
  return `${era} ${year}`;
}

/**
 * Full date in the local calendar, for debugging and tests.
 * No v1 contract endpoint consumes it.
 */
export function dateInCalendar(
  instant: Date,
  timeZone: string,
  system: CalendarSystem,
  locale: Locale,
): string {
  return new Intl.DateTimeFormat(`${intlTag(locale)}-u-ca-${system}`, {
    timeZone,
    dateStyle: 'long',
  }).format(instant);
}
