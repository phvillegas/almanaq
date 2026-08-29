import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, messagesFor, resolveLocale } from '../src/domain/i18n.js';

describe('resolveLocale', () => {
  it('picks the first supported locale in the header', () => {
    expect(resolveLocale('en-US,en;q=0.9')).toBe('en');
    expect(resolveLocale('es-AR,es;q=0.9')).toBe('es');
  });

  it('skips unsupported languages instead of giving up on the header', () => {
    expect(resolveLocale('fr-FR,de;q=0.8,en;q=0.5')).toBe('en');
  });

  it('falls back to the default when nothing matches', () => {
    expect(resolveLocale('fr-FR,de;q=0.8')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  it('ignores the region subtag', () => {
    expect(resolveLocale('es-419')).toBe('es');
    expect(resolveLocale('en-GB')).toBe('en');
  });
});

describe('catalogs', () => {
  it('covers every status in both locales', () => {
    const statuses = ['AVAILABLE', 'OFF_HOURS', 'LOCAL_WEEKEND', 'LOCAL_HOLIDAY', 'UNKNOWN'] as const;

    for (const locale of ['es', 'en'] as const) {
      const messages = messagesFor(locale);
      for (const status of statuses) {
        expect(messages.statusLabel[status]).toBeTruthy();
        expect(messages.statusLabelDetail[status]).toBeTruthy();
      }
    }
  });

  it('covers every calendar system in both locales', () => {
    const systems = [
      'hebrew',
      'ethiopic',
      'persian',
      'islamic-umalqura',
      'buddhist',
      'indian',
      'japanese',
    ] as const;

    for (const locale of ['es', 'en'] as const) {
      const messages = messagesFor(locale);
      for (const system of systems) {
        expect(messages.calendarLabel[system]).toBeTruthy();
        expect(messages.calendarNote[system]).toBeTruthy();
      }
    }
  });
});
