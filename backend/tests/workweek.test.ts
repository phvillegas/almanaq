import { describe, expect, it } from 'vitest';

import {
  formatHours,
  formatWeekend,
  formatWorkDays,
  getWorkWeek,
  isWithinHours,
  isWorkDay,
} from '../src/domain/workweek.js';

describe('getWorkWeek', () => {
  it('resolves the Israeli week as Sunday to Thursday', () => {
    const week = getWorkWeek('IL');

    expect(formatWorkDays(week, 'en')).toBe('Sun to Thu');
    expect(formatWeekend(week, 'en')).toBe('Fri and Sat');
    expect(isWorkDay(week, 'friday')).toBe(false);
    expect(isWorkDay(week, 'sunday')).toBe(true);
    expect(week.inferred).toBe(false);
  });

  it('resolves Nepal with a single day off', () => {
    const week = getWorkWeek('NP');

    expect(formatWorkDays(week, 'en')).toBe('Sun to Fri');
    expect(formatWeekend(week, 'en')).toBe('Sat');
  });

  it('resolves Iran as Saturday to Thursday', () => {
    const week = getWorkWeek('IR');

    expect(formatWorkDays(week, 'en')).toBe('Sat to Thu');
    expect(formatWeekend(week, 'en')).toBe('Fri');
  });

  it('renders the non-contiguous weekend of Brunei', () => {
    const week = getWorkWeek('BN');

    expect(formatWorkDays(week, 'en')).toBe('Mon to Thu and Sat');
    expect(formatWeekend(week, 'en')).toBe('Fri and Sun');
  });

  it('joins Saturday and Sunday as one run even though they sit at opposite ends', () => {
    const week = getWorkWeek('AR');

    expect(formatWorkDays(week, 'en')).toBe('Mon to Fri');
    expect(formatWeekend(week, 'en')).toBe('Sat and Sun');
  });

  it('flags as inferred the week of a country outside the table', () => {
    expect(getWorkWeek('AR').inferred).toBe(true);
    expect(getWorkWeek(null).inferred).toBe(true);
  });
});

describe('label localization', () => {
  it('renders the same week in both locales', () => {
    const week = getWorkWeek('IL');

    expect(formatWorkDays(week, 'es')).toBe('dom a jue');
    expect(formatWeekend(week, 'es')).toBe('vie y sáb');
    expect(formatHours(week, 'es')).toBe('9:00 a 18:00');

    expect(formatWorkDays(week, 'en')).toBe('Sun to Thu');
    expect(formatWeekend(week, 'en')).toBe('Fri and Sat');
    expect(formatHours(week, 'en')).toBe('9:00 to 18:00');
  });

  it('renders a non-contiguous weekend in Spanish too', () => {
    const week = getWorkWeek('BN');

    expect(formatWorkDays(week, 'es')).toBe('lun a jue y sáb');
    expect(formatWeekend(week, 'es')).toBe('vie y dom');
  });
});

describe('manual overrides', () => {
  it('lets the day override win over the country table', () => {
    const week = getWorkWeek('IL', { workDays: ['monday', 'tuesday', 'wednesday'] });

    expect(formatWorkDays(week, 'en')).toBe('Mon to Wed');
    expect(week.hasOverrides).toBe(true);
    // An override is data the user declared: it stops being our inference.
    expect(week.inferred).toBe(false);
  });

  it('leaves the country days alone on a partial hours override', () => {
    const week = getWorkWeek('IL', { workStartLocal: '08:00', workEndLocal: '14:30' });

    expect(formatWorkDays(week, 'en')).toBe('Sun to Thu');
    expect(formatHours(week, 'en')).toBe('8:00 to 14:30');
  });

  it('ignores badly formatted hours instead of breaking', () => {
    const week = getWorkWeek('AR', { workStartLocal: '25:00' });

    expect(formatHours(week, 'en')).toBe('9:00 to 18:00');
    expect(week.hasOverrides).toBe(false);
  });
});

describe('isWithinHours', () => {
  const week = getWorkWeek('AR');

  it('includes the start minute and excludes the end minute', () => {
    expect(isWithinHours(week, '09:00')).toBe(true);
    expect(isWithinHours(week, '17:59')).toBe(true);
    expect(isWithinHours(week, '18:00')).toBe(false);
    expect(isWithinHours(week, '08:59')).toBe(false);
  });

  it('supports shifts crossing midnight', () => {
    const overnight = getWorkWeek('AR', { workStartLocal: '22:00', workEndLocal: '06:00' });

    expect(isWithinHours(overnight, '23:30')).toBe(true);
    expect(isWithinHours(overnight, '02:00')).toBe(true);
    expect(isWithinHours(overnight, '12:00')).toBe(false);
  });
});
