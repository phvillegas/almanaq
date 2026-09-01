/**
 * Availability resolution and the user-facing text that goes with it.
 *
 * This module is the only place where availability is decided. The client receives
 * the enum already resolved and the text already written; it composes neither.
 * See PLAN.md section 4 and CLAUDE.md rule 1.
 */

import {
  formatLongDate,
  formatShortDate,
  getLocalCalendar,
  localParts,
  type LocalCalendar,
  type LocalParts,
  type LocalWeekday,
} from './calendars.js';
import { hasCoverage, holidayOn, upcomingHolidays, type Holiday } from './holidays.js';
import { intlTag, messagesFor, type Locale, type Messages, type Status } from './i18n.js';
import {
  formatHours,
  formatWeekend,
  formatWorkDays,
  getWorkWeek,
  isWithinHours,
  isWorkDay,
  type MemberOverrides,
  type WorkWeek,
} from './workweek.js';

export type { Status } from './i18n.js';

/** The minimum the backend needs about a member in order to resolve their status. */
export interface MemberInput {
  readonly countryCode: string | null;
  readonly timezone: string;
  readonly overrides?: MemberOverrides | null;
}

export interface ResolvedStatus extends LocalParts {
  readonly status: Status;
  readonly statusLabel: string;
  readonly statusDetail: string;
  readonly week: WorkWeek;
  readonly holiday: Holiday | null;
}

export interface DayConflict {
  readonly reason: Extract<Status, 'LOCAL_WEEKEND' | 'LOCAL_HOLIDAY' | 'UNKNOWN'>;
  readonly detail: string;
}

export interface MemberDetail {
  readonly localTime: string;
  readonly localDateFormatted: string;
  readonly utcOffsetMinutes: number;
  readonly status: Status;
  readonly statusLabel: string;
  /**
   * Localized country name, or `null` when the member has no usable country code.
   *
   * Added on 2026-09-01, after the contract froze, because the alternative was a
   * code-to-name table written once in Kotlin and again in Swift. ICU already knows the
   * answer and only the backend has it. Nullable rather than a placeholder string: a
   * client that has nothing to show should show nothing, not the word "Unknown" wedged
   * into an address.
   */
  readonly country: string | null;
  readonly workWeek: {
    readonly daysLabel: string;
    readonly weekendLabel: string;
    readonly hoursLabel: string;
  };
  readonly localCalendar: LocalCalendar | null;
  readonly upcomingHolidays: readonly {
    readonly name: string;
    readonly dateLabel: string;
    readonly startDate: string;
  }[];
}

/**
 * Resolves a member's status at a given instant.
 *
 * Decision order, from firmest to weakest:
 *
 * 1. Non-working day per the explicit table (or per an override) -> `LOCAL_WEEKEND`.
 *    It wins even without holiday coverage and even if the day is also a holiday: the
 *    weekend fact is the most reliable one we have, and the user does not care which
 *    of the two reasons applies.
 * 2. A holiday in the country's file -> `LOCAL_HOLIDAY`.
 * 3. No holiday coverage for that date -> `UNKNOWN`. Never `AVAILABLE`: claiming
 *    somebody is working on a day that might be a holiday is exactly the wrong data
 *    PLAN.md section 10 rule 3 forbids.
 * 4. Non-working day per the Mon to Fri default -> `LOCAL_WEEKEND`. By this point the
 *    country's holidays are covered, so it is not an unknown country: it is one that
 *    falls under the majority rule documented in PLAN.md section 5.
 * 5. Working day, and the time is within hours -> `AVAILABLE`; otherwise `OFF_HOURS`.
 *
 * What holds the whole order together is that holiday coverage is the only gate to
 * `AVAILABLE`. Without it we never claim that somebody is working.
 */
export function resolveStatus(
  member: MemberInput,
  instant: Date,
  locale: Locale,
): ResolvedStatus {
  const parts = localParts(instant, member.timezone);
  const week = getWorkWeek(member.countryCode, member.overrides);
  const messages = messagesFor(locale);
  const country = countryName(member.countryCode, locale);

  const covered = hasCoverage(member.countryCode, parts.localDate);
  const holiday = covered ? holidayOn(member.countryCode, parts.localDate) : null;

  const { status, statusDetail } = decide({
    day: parts.localWeekday,
    time: parts.localTime,
    week,
    covered,
    holiday,
    country,
    messages,
  });

  return {
    ...parts,
    status,
    statusLabel: messages.statusLabel[status],
    statusDetail,
    week,
    holiday,
  };
}

/**
 * A member's conflict on a calendar date, without a time of day.
 *
 * The date is evaluated as the member's local date: it is the date of the meeting the
 * user is picking, not an instant to convert between zones. That is why neither
 * `AVAILABLE` nor `OFF_HOURS` appear here: with no time there are no working hours to
 * evaluate.
 *
 * Returns `null` when the day is clear. The month view only paints days with
 * conflicts. See PLAN.md section 4, `POST /v1/calendar`.
 */
export function resolveDayConflict(
  member: MemberInput,
  isoDate: string,
  locale: Locale,
): DayConflict | null {
  const week = getWorkWeek(member.countryCode, member.overrides);
  const messages = messagesFor(locale);
  const country = countryName(member.countryCode, locale);
  const day = weekdayOfDate(isoDate);

  const covered = hasCoverage(member.countryCode, isoDate);
  const holiday = covered ? holidayOn(member.countryCode, isoDate) : null;

  if (!week.inferred && !isWorkDay(week, day)) {
    return { reason: 'LOCAL_WEEKEND', detail: messages.weekendIn(country) };
  }
  if (holiday) {
    return {
      reason: 'LOCAL_HOLIDAY',
      detail: messages.holidayIn(country, holidayName(holiday)),
    };
  }
  if (!covered) {
    return { reason: 'UNKNOWN', detail: messages.noHolidayData(country) };
  }
  if (!isWorkDay(week, day)) {
    return { reason: 'LOCAL_WEEKEND', detail: messages.weekendIn(country) };
  }
  return null;
}

/** Builds the `POST /v1/member/detail` response. */
export function resolveDetail(
  member: MemberInput,
  instant: Date,
  locale: Locale,
): MemberDetail {
  const resolved = resolveStatus(member, instant, locale);
  const messages = messagesFor(locale);

  return {
    localTime: resolved.localTime,
    localDateFormatted: formatLongDate(instant, member.timezone, locale),
    utcOffsetMinutes: resolved.utcOffsetMinutes,
    status: resolved.status,
    statusLabel: messages.statusLabelDetail[resolved.status],
    country: knownCountryName(member.countryCode, locale),
    workWeek: {
      daysLabel: formatWorkDays(resolved.week, locale),
      weekendLabel: formatWeekend(resolved.week, locale),
      hoursLabel: formatHours(resolved.week, locale),
    },
    localCalendar: getLocalCalendar(member.countryCode, instant, member.timezone, locale),
    upcomingHolidays: upcomingHolidays(member.countryCode, resolved.localDate, 3).map(
      (holiday) => ({
        name: holidayName(holiday),
        // Anchored at noon UTC and formatted in UTC: a holiday date is a civil date,
        // not an instant, and midnight would shift it a day in negative offsets.
        dateLabel: formatShortDate(new Date(`${holiday.date}T12:00:00Z`), 'UTC', locale),
        startDate: holiday.date,
      }),
    ),
  };
}

function decide(input: {
  day: LocalWeekday;
  time: string;
  week: WorkWeek;
  covered: boolean;
  holiday: Holiday | null;
  country: string;
  messages: Messages;
}): { status: Status; statusDetail: string } {
  const { day, time, week, covered, holiday, country, messages } = input;

  if (!week.inferred && !isWorkDay(week, day)) {
    return { status: 'LOCAL_WEEKEND', statusDetail: messages.weekendIn(country) };
  }
  if (holiday) {
    return {
      status: 'LOCAL_HOLIDAY',
      statusDetail: messages.holidayIn(country, holidayName(holiday)),
    };
  }
  if (!covered) {
    return { status: 'UNKNOWN', statusDetail: messages.noHolidayData(country) };
  }
  if (!isWorkDay(week, day)) {
    // Country outside the table but with holidays covered: the majority rule applies.
    return { status: 'LOCAL_WEEKEND', statusDetail: messages.weekendIn(country) };
  }
  if (isWithinHours(week, time)) {
    return {
      status: 'AVAILABLE',
      statusDetail: messages.workingUntil(stripLeadingZero(week.endLocal)),
    };
  }
  if (time < week.startLocal) {
    return { status: 'OFF_HOURS', statusDetail: messages.startsAt(stripLeadingZero(week.startLocal)) };
  }
  return { status: 'OFF_HOURS', statusDetail: messages.finishedAt(stripLeadingZero(week.endLocal)) };
}

/**
 * The holiday name as the provider supplies it.
 *
 * KNOWN LIMITATION: holiday names are not localized. Nager.Date returns an English
 * name and a local one in the country's own script. The English one wins because the
 * local one comes in alphabets most readers cannot read (Amharic, Hebrew, Thai).
 * Translating them would need a hand-maintained table, which is the kind of data
 * PLAN.md section 10 rule 3 prefers not to invent.
 */
function holidayName(holiday: Holiday): string {
  return holiday.name || holiday.localName || 'Holiday';
}

/**
 * Country name in the requested locale, or `null` when there is no usable code.
 *
 * Separate from `countryName` on purpose. That one is for prose — "Weekend in Israel" —
 * and needs a word even when the country is unknown. This one is for an address line,
 * where the honest answer to "which country" is to say nothing at all.
 */
function knownCountryName(countryCode: string | null | undefined, locale: Locale): string | null {
  if (typeof countryCode !== 'string') return null;
  if (!/^[A-Za-z]{2}$/.test(countryCode.trim())) return null;
  return countryName(countryCode, locale);
}

/** Country name in the requested locale, straight from ICU. */
function countryName(countryCode: string | null | undefined, locale: Locale): string {
  const messages = messagesFor(locale);
  if (typeof countryCode !== 'string') return messages.unknownCountry;
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return messages.unknownCountry;
  try {
    return new Intl.DisplayNames([intlTag(locale)], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Weekday of a "YYYY-MM-DD" date, read as a civil date.
 *
 * Anchored at noon UTC on purpose: at midnight, formatting in any negative offset
 * would return the previous day. Same bug as the SETUP.md snippet.
 */
function weekdayOfDate(isoDate: string): LocalWeekday {
  return localParts(new Date(`${isoDate}T12:00:00Z`), 'UTC').localWeekday;
}

function stripLeadingZero(time: string): string {
  return time.replace(/^0/, '');
}
