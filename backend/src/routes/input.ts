/**
 * Validation and normalization of whatever arrives over HTTP.
 *
 * The three endpoints that receive teams share the same member parsing, so it lives
 * here instead of being repeated in each one.
 *
 * Rule: reject early, with a message naming the offending field. The backend has no
 * state and no authentication, so the request body is all there is; if it comes in
 * wrong there is nothing to assume.
 *
 * These messages are for whoever is building a client, not for end users, so unlike
 * `statusDetail` they are not localized. They stay in English.
 *
 * STRUCTURE NOTE: this file is not in the list in SETUP.md section 2.
 */

import { isValidTimeZone } from '../domain/calendars.js';
import type { Weekday } from '../data/workweeks.js';
import type { MemberInput } from '../domain/status.js';

/** Cap on members per request. A real team is nowhere near it. */
const MAX_MEMBERS = 200;
/** Cap on days per calendar query: a bit over one year. */
const MAX_DAYS = 366;

const VALID_WEEKDAYS: readonly string[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export type ErrorCode = 'INVALID_BODY' | 'INVALID_MEMBER' | 'INVALID_RANGE';

export class InputError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'InputError';
  }
}

/** A validated member, carrying the `id` the client uses to match it back. */
export interface MemberWithId extends MemberInput {
  readonly id: string;
}

export function asObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InputError('INVALID_BODY', `${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

/**
 * Parses an ISO 8601 instant.
 *
 * The zone marker is required: "2026-08-21T15:42:00" with no `Z` and no offset is
 * ambiguous, and resolving it with the server's zone is the very bug that poisons
 * everything downstream.
 */
export function parseInstant(value: unknown, field = '`at`'): Date {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new InputError('INVALID_BODY', `${field} is required and must be ISO 8601`);
  }
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())) {
    throw new InputError(
      'INVALID_BODY',
      `${field} must carry a time zone (for example 2026-08-21T15:42:00Z)`,
    );
  }
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new InputError('INVALID_BODY', `${field} is not a valid date: ${value}`);
  }
  return instant;
}

/** Parses a civil date "YYYY-MM-DD" and checks that it exists in the calendar. */
export function parseDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InputError('INVALID_BODY', `${field} must be formatted as YYYY-MM-DD`);
  }
  const instant = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(instant.getTime())) {
    throw new InputError('INVALID_BODY', `${field} is not a real date: ${value}`);
  }
  if (!instant.toISOString().startsWith(value)) {
    throw new InputError('INVALID_BODY', `${field} is not a real date: ${value}`);
  }
  return value;
}

/** Returns every date in the range, inclusive. */
export function expandRange(from: string, to: string): string[] {
  if (to < from) {
    throw new InputError('INVALID_RANGE', '`to` cannot be earlier than `from`');
  }

  const dates: string[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    if (dates.length > MAX_DAYS) {
      throw new InputError('INVALID_RANGE', `The range cannot exceed ${MAX_DAYS} days`);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function parseMembers(value: unknown): MemberWithId[] {
  if (!Array.isArray(value)) {
    throw new InputError('INVALID_BODY', '`members` must be an array');
  }
  if (value.length > MAX_MEMBERS) {
    throw new InputError('INVALID_BODY', `No more than ${MAX_MEMBERS} members are accepted`);
  }
  return value.map((member, position) => parseMember(member, `members[${position}]`));
}

export function parseMember(value: unknown, field: string): MemberWithId {
  const raw = asObject(value, field);

  const id = raw['id'];
  if (typeof id !== 'string' || id.trim() === '') {
    throw new InputError('INVALID_MEMBER', `${field}.id is required`);
  }

  const timezone = raw['timezone'];
  if (typeof timezone !== 'string' || !isValidTimeZone(timezone)) {
    throw new InputError(
      'INVALID_MEMBER',
      `${field}.timezone is not a known IANA time zone: ${String(timezone)}`,
    );
  }

  return {
    id,
    countryCode: parseCountryCode(raw['countryCode']),
    timezone,
    overrides: parseOverrides(raw['overrides'], field),
  };
}

function parseCountryCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim();
  if (!/^[A-Za-z]{2}$/.test(code)) return null;
  return code.toUpperCase();
}

/**
 * Overrides are optional and every field may be `null`, meaning "use the country
 * value". An invalid value is rejected rather than ignored: if the user corrected
 * their hours by hand, silently dropping it shows them data they did not ask for.
 */
function parseOverrides(
  value: unknown,
  field: string,
): {
  workDays: Weekday[] | null;
  workStartLocal: string | null;
  workEndLocal: string | null;
} | null {
  if (value === undefined || value === null) return null;
  const raw = asObject(value, `${field}.overrides`);

  return {
    workDays: parseWorkDays(raw['workDays'], `${field}.overrides.workDays`),
    workStartLocal: parseTime(raw['workStartLocal'], `${field}.overrides.workStartLocal`),
    workEndLocal: parseTime(raw['workEndLocal'], `${field}.overrides.workEndLocal`),
  };
}

function parseWorkDays(value: unknown, field: string): Weekday[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    throw new InputError('INVALID_MEMBER', `${field} must be an array`);
  }

  const invalid = value.find((day) => typeof day !== 'string' || !VALID_WEEKDAYS.includes(day));
  if (invalid !== undefined) {
    throw new InputError('INVALID_MEMBER', `${field} has an invalid day: ${String(invalid)}`);
  }
  return value as Weekday[];
}

function parseTime(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new InputError('INVALID_MEMBER', `${field} must be formatted as HH:MM`);
  }
  return value;
}
