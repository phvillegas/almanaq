/**
 * A member's work week: resolution from the static table, manual overrides, and the
 * labels the detail screen renders.
 *
 * This module knows nothing about time zones or holidays. It receives a weekday and a
 * time already expressed in the member's local zone. The conversion lives in
 * `calendars.ts`.
 */

import {
  DEFAULT_HOURS,
  DEFAULT_WORK_WEEK,
  WEEKDAYS,
  WORK_WEEKS,
  type Weekday,
} from '../data/workweeks.js';
import { messagesFor, type Locale, type Messages } from './i18n.js';

/** Manual overrides set by the user. `null` means "use the country value". */
export interface MemberOverrides {
  readonly workDays?: readonly Weekday[] | null;
  readonly workStartLocal?: string | null;
  readonly workEndLocal?: string | null;
}

export interface WorkWeek {
  readonly workDays: readonly Weekday[];
  /** Local start time, "HH:MM". */
  readonly startLocal: string;
  /** Local end time, "HH:MM". */
  readonly endLocal: string;
  /**
   * `true` when the country is not in the table and fell back to Mon to Fri.
   *
   * The status layer uses this to avoid claiming availability on data we never
   * verified. See PLAN.md section 7.4.
   */
  readonly inferred: boolean;
  /** `true` if the user corrected something by hand. An override always wins. */
  readonly hasOverrides: boolean;
  readonly note?: string;
}

const VALID_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Order used only to render labels.
 *
 * It starts on Monday, like the calendar grid (PLAN.md section 7.2). The data model
 * still uses `WEEKDAYS`, which starts on Sunday by ICU convention. Rendering from
 * Monday puts the runs where a reader expects them: Brunei's weekend comes out as
 * "Fri and Sun" rather than "Sun and Fri".
 */
const LABEL_ORDER: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/**
 * Resolves a member's effective work week.
 *
 * Precedence: manual override > country table > Mon to Fri default. A partial
 * override (hours only, for instance) leaves the rest on the country value.
 */
export function getWorkWeek(
  countryCode: string | null | undefined,
  overrides?: MemberOverrides | null,
): WorkWeek {
  const code = normalizeCountry(countryCode);
  const entry = (code && WORK_WEEKS[code]) || DEFAULT_WORK_WEEK;
  const inferred = !code || WORK_WEEKS[code] === undefined;

  const daysOverride = normalizeDays(overrides?.workDays);
  const startOverride = normalizeTime(overrides?.workStartLocal);
  const endOverride = normalizeTime(overrides?.workEndLocal);
  const hasOverrides =
    daysOverride !== null || startOverride !== null || endOverride !== null;
  const keepsCountryDays = daysOverride === null;

  return {
    workDays: daysOverride ?? entry.workDays,
    startLocal: startOverride ?? DEFAULT_HOURS.startLocal,
    endLocal: endOverride ?? DEFAULT_HOURS.endLocal,
    // An override of days makes the data explicit: it stops being our inference.
    inferred: inferred && keepsCountryDays,
    hasOverrides,
    ...(entry.note !== undefined && keepsCountryDays ? { note: entry.note } : {}),
  };
}

export function isWorkDay(week: WorkWeek, day: Weekday): boolean {
  return week.workDays.includes(day);
}

/**
 * Does the local time fall within working hours?
 *
 * `localTime` comes as 24-hour "HH:MM". The interval is closed at the start and open
 * at the end: at 18:00 sharp the member is no longer available.
 *
 * When the end is less than or equal to the start, the shift is read as crossing
 * midnight. Not a v1 case, but a manual override can produce it.
 */
export function isWithinHours(week: WorkWeek, localTime: string): boolean {
  const now = toMinutes(localTime);
  const start = toMinutes(week.startLocal);
  const end = toMinutes(week.endLocal);
  if (now === null || start === null || end === null) return false;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

/** Working days label: "dom a jue" / "Sun to Thu". */
export function formatWorkDays(week: WorkWeek, locale: Locale): string {
  return formatDaySet(week.workDays, locale);
}

/** Weekend label: "vie y sáb" / "Fri and Sat". */
export function formatWeekend(week: WorkWeek, locale: Locale): string {
  const off = WEEKDAYS.filter((day) => !week.workDays.includes(day));
  return formatDaySet(off, locale);
}

/** Hours label: "9:00 a 18:00" / "9:00 to 18:00". No leading zero. */
export function formatHours(week: WorkWeek, locale: Locale): string {
  return messagesFor(locale).hoursRange(
    stripLeadingZero(week.startLocal),
    stripLeadingZero(week.endLocal),
  );
}

/**
 * Groups the days into contiguous runs and renders them.
 *
 * Contiguity is cyclic: Saturday and Sunday form a single run even though they sit at
 * opposite ends of the array. A run of two days joins with "and"; three or more with
 * "to".
 */
function formatDaySet(days: readonly Weekday[], locale: Locale): string {
  const messages = messagesFor(locale);
  const total = LABEL_ORDER.length;
  const present = LABEL_ORDER.filter((day) => days.includes(day));
  if (present.length === 0) return messages.noDays;
  if (present.length === total) return messages.everyDay;

  const indexes = present.map((day) => LABEL_ORDER.indexOf(day));
  // Start right after a gap, so a cyclic run does not get split in two.
  const start = indexes.find((i) => !indexes.includes((i + total - 1) % total)) ?? indexes[0]!;

  const runs: Weekday[][] = [];
  let current: Weekday[] = [];

  for (let step = 0; step < total; step++) {
    const index = (start + step) % total;
    const day = LABEL_ORDER[index]!;
    const isPresent = indexes.includes(index);
    if (isPresent) current.push(day);
    if (isPresent) continue;
    if (current.length === 0) continue;
    runs.push(current);
    current = [];
  }
  if (current.length > 0) runs.push(current);

  return runs.map((run) => describeRun(run, messages)).join(` ${messages.pairJoin} `);
}

function describeRun(run: readonly Weekday[], messages: Messages): string {
  const first = messages.weekdayAbbreviation[run[0]!];
  if (run.length === 1) return first;
  const last = messages.weekdayAbbreviation[run[run.length - 1]!];
  if (run.length === 2) return `${first} ${messages.pairJoin} ${last}`;
  return `${first} ${messages.rangeJoin} ${last}`;
}

function normalizeCountry(countryCode: string | null | undefined): string | null {
  if (typeof countryCode !== 'string') return null;
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return code;
}

function normalizeDays(days: readonly Weekday[] | null | undefined): readonly Weekday[] | null {
  if (!Array.isArray(days) || days.length === 0) return null;
  const valid = WEEKDAYS.filter((day) => days.includes(day));
  if (valid.length === 0) return null;
  return valid;
}

function normalizeTime(time: string | null | undefined): string | null {
  if (typeof time !== 'string') return null;
  if (!VALID_TIME.test(time)) return null;
  return time;
}

function toMinutes(time: string): number | null {
  const parts = VALID_TIME.exec(time);
  if (!parts) return null;
  return Number(parts[1]) * 60 + Number(parts[2]);
}

function stripLeadingZero(time: string): string {
  return time.replace(/^0/, '');
}
