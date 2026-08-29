import { describe, expect, it } from 'vitest';

import { hasCoverage, upcomingHolidays } from '../src/domain/holidays.js';
import { resolveDayConflict, resolveDetail, resolveStatus } from '../src/domain/status.js';

const ISRAEL = { countryCode: 'IL', timezone: 'Asia/Jerusalem' };
const ETHIOPIA = { countryCode: 'ET', timezone: 'Africa/Addis_Ababa' };
const NEPAL = { countryCode: 'NP', timezone: 'Asia/Kathmandu' };
const ARGENTINA = { countryCode: 'AR', timezone: 'America/Argentina/Buenos_Aires' };
const BHUTAN = { countryCode: 'BT', timezone: 'Asia/Thimphu' };

describe('Israel — Friday and Saturday weekend', () => {
  it('marks Friday as a local weekend', () => {
    // Friday 21 Aug 2026, 18:42 in Tel Aviv. The case that defines the product: in
    // Buenos Aires it is Friday noon and looks like an ordinary working day.
    const status = resolveStatus(ISRAEL, new Date('2026-08-21T15:42:00Z'), 'en');

    expect(status.status).toBe('LOCAL_WEEKEND');
    expect(status.statusLabel).toBe('Weekend');
    expect(status.statusDetail).toBe('Weekend in Israel');
    expect(status.localTime).toBe('18:42');
    expect(status.utcOffsetMinutes).toBe(180);
  });

  it('treats Sunday as a working day', () => {
    const status = resolveStatus(ISRAEL, new Date('2026-08-23T07:00:00Z'), 'en');

    expect(status.localWeekday).toBe('sunday');
    expect(status.status).not.toBe('LOCAL_WEEKEND');
  });

  it('resolves a working Sunday, now that Israel has holiday coverage', () => {
    // Nager.Date does not cover Israel; date-holidays does, and the build script falls
    // back to it. Before that, this same Sunday came back UNKNOWN.
    expect(hasCoverage('IL', '2026-08-23')).toBe(true);

    const status = resolveStatus(ISRAEL, new Date('2026-08-23T07:00:00Z'), 'en');

    expect(status.status).toBe('AVAILABLE');
    expect(status.statusDetail).toBe('Working until 18:00');
  });
});

describe('Ethiopia — own calendar and national holiday', () => {
  it('marks the holiday with its name', () => {
    // 2 March 2026: Adwa Victory Day, a Monday.
    const status = resolveStatus(ETHIOPIA, new Date('2026-03-02T09:00:00Z'), 'en');

    expect(status.status).toBe('LOCAL_HOLIDAY');
    expect(status.statusLabel).toBe('Holiday');
    expect(status.statusDetail).toBe('Holiday in Ethiopia: Adwa Victory Day');
    expect(status.holiday?.date).toBe('2026-03-02');
  });

  it('reports an ordinary working day within hours as available', () => {
    // Tuesday 3 March, 12:00 in Addis Ababa.
    const status = resolveStatus(ETHIOPIA, new Date('2026-03-03T09:00:00Z'), 'en');

    expect(status.status).toBe('AVAILABLE');
    expect(status.statusDetail).toBe('Working until 18:00');
  });

  it('distinguishes a day that has not started from one already finished', () => {
    const early = resolveStatus(ETHIOPIA, new Date('2026-03-03T04:00:00Z'), 'en');
    const late = resolveStatus(ETHIOPIA, new Date('2026-03-03T16:00:00Z'), 'en');

    expect(early.status).toBe('OFF_HOURS');
    expect(early.statusDetail).toBe('Starts at 9:00');
    expect(late.status).toBe('OFF_HOURS');
    expect(late.statusDetail).toBe('Finished at 18:00');
  });

  it('builds the detail with the local calendar and upcoming holidays', () => {
    const detail = resolveDetail(ETHIOPIA, new Date('2026-03-02T09:00:00Z'), 'en');

    expect(detail.localCalendar?.label).toBe('Ethiopic');
    expect(detail.localCalendar?.currentYear).toBe('2018');
    expect(detail.workWeek.daysLabel).toBe('Mon to Fri');
    expect(detail.upcomingHolidays.length).toBeGreaterThan(0);
    expect(detail.upcomingHolidays.length).toBeLessThanOrEqual(3);
    expect(detail.upcomingHolidays[0]?.startDate).toBe('2026-03-02');
    expect(detail.upcomingHolidays[0]?.dateLabel).toBe('March 2');
  });
});

describe('Nepal — 5:45 offset and Saturday off', () => {
  it('resolves the local time with a fractional offset', () => {
    const status = resolveStatus(NEPAL, new Date('2026-08-21T00:00:00Z'), 'en');

    expect(status.utcOffsetMinutes).toBe(345);
    expect(status.localTime).toBe('05:45');
  });

  it('treats Saturday as the weekend even without holiday data', () => {
    // Saturday 22 Aug 2026. The work week table does cover Nepal, so the weekend is
    // asserted confidently even with no holiday coverage.
    const status = resolveStatus(NEPAL, new Date('2026-08-22T06:00:00Z'), 'en');

    expect(status.localWeekday).toBe('saturday');
    expect(status.status).toBe('LOCAL_WEEKEND');
    expect(status.statusDetail).toBe('Weekend in Nepal');
  });

  it('treats Friday as a working day in Nepal', () => {
    const status = resolveStatus(NEPAL, new Date('2026-08-21T06:00:00Z'), 'en');

    expect(status.localWeekday).toBe('friday');
    expect(status.status).not.toBe('LOCAL_WEEKEND');
  });
});

describe('country without data', () => {
  it('returns UNKNOWN instead of assuming Monday to Friday', () => {
    // Bhutan is in neither the work week table nor the holiday files.
    const status = resolveStatus(BHUTAN, new Date('2026-08-19T06:00:00Z'), 'en');

    expect(status.status).toBe('UNKNOWN');
    expect(status.statusLabel).toBe('No data');
    expect(status.statusDetail).toBe('No holiday data for Bhutan');
  });

  it('lets a manual override resolve a country outside the table', () => {
    const status = resolveStatus(
      { ...BHUTAN, overrides: { workDays: ['monday', 'tuesday', 'wednesday', 'thursday'] } },
      new Date('2026-08-21T06:00:00Z'),
      'en',
    );

    // Friday with an override: the user declared they do not work. It is no longer an
    // assumption of ours, even though there is still no holiday data.
    expect(status.localWeekday).toBe('friday');
    expect(status.status).toBe('LOCAL_WEEKEND');
  });

  it('reports no holidays for a country without a file', () => {
    expect(upcomingHolidays('BT', '2026-01-01')).toEqual([]);
    expect(hasCoverage('BT', '2026-08-19')).toBe(false);
  });

  it('leaves Palestine UNKNOWN, the one target country no source covers', () => {
    // In the work week table (Sun to Thu) but absent from all three holiday sources.
    // The weekend still resolves; working days cannot.
    const palestine = { countryCode: 'PS', timezone: 'Asia/Hebron' };

    expect(hasCoverage('PS', '2026-08-19')).toBe(false);
    expect(resolveStatus(palestine, new Date('2026-08-19T09:00:00Z'), 'en').status).toBe(
      'UNKNOWN',
    );
    expect(resolveStatus(palestine, new Date('2026-08-21T09:00:00Z'), 'en').status).toBe(
      'LOCAL_WEEKEND',
    );
  });

  it('treats a year outside the generated range as uncovered', () => {
    // Argentina has a file, but only for the years the script generated.
    expect(hasCoverage('AR', '2026-08-19')).toBe(true);
    expect(hasCoverage('AR', '2040-08-19')).toBe(false);

    expect(resolveStatus(ARGENTINA, new Date('2040-08-20T13:00:00Z'), 'en').status).toBe(
      'UNKNOWN',
    );
  });
});

describe('localization of user facing text', () => {
  it('writes the same status in the requested language', () => {
    const instant = new Date('2026-08-21T15:42:00Z');
    const spanish = resolveStatus(ISRAEL, instant, 'es');
    const english = resolveStatus(ISRAEL, instant, 'en');

    expect(spanish.status).toBe(english.status);
    expect(spanish.statusLabel).toBe('Fin de semana');
    expect(spanish.statusDetail).toBe('Fin de semana en Israel');
    expect(english.statusLabel).toBe('Weekend');
    expect(english.statusDetail).toBe('Weekend in Israel');
  });

  it('localizes country names', () => {
    const instant = new Date('2026-03-02T09:00:00Z');

    expect(resolveStatus(ETHIOPIA, instant, 'es').statusDetail).toBe(
      'Feriado en Etiopía: Adwa Victory Day',
    );
    expect(resolveStatus(ETHIOPIA, instant, 'en').statusDetail).toBe(
      'Holiday in Ethiopia: Adwa Victory Day',
    );
  });

  it('leaves holiday names untranslated, because they are provider data', () => {
    const spanish = resolveDetail(ETHIOPIA, new Date('2026-03-02T09:00:00Z'), 'es');
    const english = resolveDetail(ETHIOPIA, new Date('2026-03-02T09:00:00Z'), 'en');

    expect(spanish.upcomingHolidays[0]?.name).toBe(english.upcomingHolidays[0]?.name);
    // The date around the name is localized even though the name is not.
    expect(spanish.upcomingHolidays[0]?.dateLabel).toBe('2 de marzo');
    expect(english.upcomingHolidays[0]?.dateLabel).toBe('March 2');
  });
});

describe('resolveDayConflict', () => {
  it('returns null when the day is clear', () => {
    expect(resolveDayConflict(ETHIOPIA, '2026-03-03', 'en')).toBeNull();
  });

  it('reports the Israeli local weekend', () => {
    expect(resolveDayConflict(ISRAEL, '2026-08-21', 'en')).toEqual({
      reason: 'LOCAL_WEEKEND',
      detail: 'Weekend in Israel',
    });
  });

  it('reports the holiday with its name', () => {
    expect(resolveDayConflict(ETHIOPIA, '2026-03-02', 'en')).toEqual({
      reason: 'LOCAL_HOLIDAY',
      detail: 'Holiday in Ethiopia: Adwa Victory Day',
    });
  });

  it('does not evaluate working hours, because a date has no time', () => {
    expect(resolveDayConflict(ARGENTINA, '2026-08-19', 'en')).toBeNull();
  });

  it('reads the date as a civil date, without shifting it by time zone', () => {
    // Anchored at midnight UTC, a negative offset would return the previous day and
    // Saturday would read as Friday.
    expect(resolveDayConflict(ARGENTINA, '2026-08-22', 'en')?.reason).toBe('LOCAL_WEEKEND');
    expect(resolveDayConflict(ARGENTINA, '2026-08-21', 'en')).toBeNull();
  });
});
