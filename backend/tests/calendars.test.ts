import { describe, expect, it } from 'vitest';

import {
  formatLongDate,
  getLocalCalendar,
  localParts,
  localYear,
  offsetInMinutes,
} from '../src/domain/calendars.js';

describe('localParts', () => {
  it('converts a UTC instant into the member local time', () => {
    const parts = localParts(new Date('2026-08-21T15:42:00Z'), 'Asia/Jerusalem');

    expect(parts.localTime).toBe('18:42');
    expect(parts.localDate).toBe('2026-08-21');
    expect(parts.localWeekday).toBe('friday');
    expect(parts.utcOffsetMinutes).toBe(180);
  });

  it('resolves offsets that are not whole hours', () => {
    // Nepal sits at UTC+5:45. It is the case that breaks any implementation storing
    // offsets in hours. See PLAN.md section 9.
    const parts = localParts(new Date('2026-08-21T00:00:00Z'), 'Asia/Kathmandu');

    expect(parts.utcOffsetMinutes).toBe(345);
    expect(parts.localTime).toBe('05:45');
  });

  it('follows daylight saving time instead of using a fixed offset', () => {
    const winter = offsetInMinutes(new Date('2026-01-15T12:00:00Z'), 'Europe/Madrid');
    const summer = offsetInMinutes(new Date('2026-07-15T12:00:00Z'), 'Europe/Madrid');

    expect(winter).toBe(60);
    expect(summer).toBe(120);
  });

  it('renders midnight as 00:00 and not as 24:00', () => {
    const parts = localParts(new Date('2026-08-21T00:00:00Z'), 'UTC');

    expect(parts.localTime).toBe('00:00');
    expect(parts.localDate).toBe('2026-08-21');
  });

  it('rejects unknown time zones instead of falling back to a default', () => {
    expect(() => localParts(new Date(), 'Mars/Olympus')).toThrow(RangeError);
  });

  it('derives the local date from the requested zone, not the process zone', () => {
    // This is the trap in the SETUP.md section 2 snippet: `new Date('2026-08-17')` is
    // midnight UTC, so in any negative offset it is still the previous day.
    const midnightUtc = new Date('2026-08-17');

    expect(localParts(midnightUtc, 'UTC').localDate).toBe('2026-08-17');
    expect(localParts(midnightUtc, 'America/Argentina/Buenos_Aires').localDate).toBe(
      '2026-08-16',
    );
  });
});

describe('formatLongDate', () => {
  it('writes the date in the requested locale, without the year', () => {
    const instant = new Date('2026-08-21T15:42:00Z');

    expect(formatLongDate(instant, 'Asia/Jerusalem', 'es')).toBe('viernes, 21 de agosto');
    expect(formatLongDate(instant, 'Asia/Jerusalem', 'en')).toBe('Friday, August 21');
  });
});

describe('getLocalCalendar', () => {
  it('resolves the Ethiopic calendar with its local year', () => {
    const calendar = getLocalCalendar(
      'ET',
      new Date('2026-08-21T15:42:00Z'),
      'Africa/Addis_Ababa',
      'en',
    );

    expect(calendar?.system).toBe('ethiopic');
    expect(calendar?.label).toBe('Ethiopic');
    expect(calendar?.currentYear).toBe('2018');
    expect(calendar?.note).not.toBeNull();
  });

  it('localizes the label and the note', () => {
    const instant = new Date('2026-08-21T15:42:00Z');
    const spanish = getLocalCalendar('IL', instant, 'Asia/Jerusalem', 'es');
    const english = getLocalCalendar('IL', instant, 'Asia/Jerusalem', 'en');

    expect(spanish?.label).toBe('Hebreo');
    expect(spanish?.note).toContain('atardecer');
    expect(english?.label).toBe('Hebrew');
    expect(english?.note).toContain('sunset');
    // The year is a number: it does not change with the locale.
    expect(spanish?.currentYear).toBe(english?.currentYear);
    expect(english?.currentYear).toBe('5786');
  });

  it('includes the era in the Japanese calendar', () => {
    expect(localYear(new Date('2026-08-21T15:42:00Z'), 'Asia/Tokyo', 'japanese', 'en')).toBe(
      'Reiwa 8',
    );
  });

  it('returns null for countries without a calendar of their own', () => {
    expect(
      getLocalCalendar('AR', new Date(), 'America/Argentina/Buenos_Aires', 'en'),
    ).toBeNull();
  });

  it('returns null for Nepal instead of approximating Bikram Sambat', () => {
    // ICU does not ship Bikram Sambat. Showing another system would be inventing data.
    // See PLAN.md section 5.
    expect(getLocalCalendar('NP', new Date(), 'Asia/Kathmandu', 'en')).toBeNull();
  });
});
