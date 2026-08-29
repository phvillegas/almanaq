/**
 * Message catalog for the text the backend writes for end users.
 *
 * The client never composes these strings: it receives `statusLabel` and
 * `statusDetail` ready to render. See PLAN.md section 4 and CLAUDE.md rule 1. Keeping
 * them here is what makes adding a language a server deploy instead of two app store
 * releases (PLAN.md section 13).
 *
 * Source code, comments and error messages are in English. Everything in this file is
 * product content, so it is localized instead.
 *
 * Holiday names are NOT translated: they come from the provider as data. See the note
 * in `status.ts`.
 */

import type { Weekday } from '../data/workweeks.js';
import type { CalendarSystem } from './calendars.js';

export type Locale = 'es' | 'en';

/**
 * Locale used when the client asks for nothing, or asks for something we do not have.
 *
 * Spanish, matching the mockups in `design/`. Changing it changes what every client
 * that omits `Accept-Language` receives.
 */
export const DEFAULT_LOCALE: Locale = 'es';

export type Status =
  | 'AVAILABLE'
  | 'OFF_HOURS'
  | 'LOCAL_WEEKEND'
  | 'LOCAL_HOLIDAY'
  | 'UNKNOWN';

export interface Messages {
  /** Short label for a list row. */
  readonly statusLabel: Readonly<Record<Status, string>>;
  /** Longer label for the detail screen, which has more room. */
  readonly statusLabelDetail: Readonly<Record<Status, string>>;
  readonly weekendIn: (country: string) => string;
  readonly holidayIn: (country: string, holiday: string) => string;
  readonly noHolidayData: (country: string) => string;
  readonly workingUntil: (time: string) => string;
  readonly startsAt: (time: string) => string;
  readonly finishedAt: (time: string) => string;
  readonly weekdayAbbreviation: Readonly<Record<Weekday, string>>;
  /** Joins the ends of a run of three or more days: "Mon to Fri". */
  readonly rangeJoin: string;
  /** Joins two days, or two runs: "Fri and Sat". */
  readonly pairJoin: string;
  readonly everyDay: string;
  readonly noDays: string;
  readonly hoursRange: (start: string, end: string) => string;
  readonly calendarLabel: Readonly<Record<CalendarSystem, string>>;
  readonly calendarNote: Readonly<Record<CalendarSystem, string>>;
  /** Stand-in when the member has no usable country code. */
  readonly unknownCountry: string;
}

const SPANISH: Messages = {
  statusLabel: {
    AVAILABLE: 'Disponible',
    OFF_HOURS: 'Fuera de horario',
    LOCAL_WEEKEND: 'Fin de semana',
    LOCAL_HOLIDAY: 'Feriado',
    UNKNOWN: 'Sin datos',
  },
  statusLabelDetail: {
    AVAILABLE: 'Disponible ahora',
    OFF_HOURS: 'Fuera de horario',
    LOCAL_WEEKEND: 'Fin de semana local',
    LOCAL_HOLIDAY: 'Feriado local',
    UNKNOWN: 'Sin datos suficientes',
  },
  weekendIn: (country) => `Fin de semana en ${country}`,
  holidayIn: (country, holiday) => `Feriado en ${country}: ${holiday}`,
  noHolidayData: (country) => `Sin datos de feriados en ${country}`,
  workingUntil: (time) => `En horario hasta las ${time}`,
  startsAt: (time) => `Empieza a las ${time}`,
  finishedAt: (time) => `Terminó a las ${time}`,
  weekdayAbbreviation: {
    sunday: 'dom',
    monday: 'lun',
    tuesday: 'mar',
    wednesday: 'mié',
    thursday: 'jue',
    friday: 'vie',
    saturday: 'sáb',
  },
  rangeJoin: 'a',
  pairJoin: 'y',
  everyDay: 'todos los días',
  noDays: '—',
  hoursRange: (start, end) => `${start} a ${end}`,
  calendarLabel: {
    hebrew: 'Hebreo',
    ethiopic: 'Etíope',
    persian: 'Persa',
    'islamic-umalqura': 'Hiyrí (Um al-Qura)',
    buddhist: 'Budista',
    indian: 'Saka',
    japanese: 'Japonés',
  },
  calendarNote: {
    hebrew: 'El día empieza al atardecer, no a medianoche.',
    ethiopic: 'El año tiene 13 meses y arranca en septiembre del calendario gregoriano.',
    persian: 'El año arranca en el equinoccio de marzo (Nouruz).',
    'islamic-umalqura':
      'El día empieza al atardecer. Um al-Qura es la variante tabular oficial saudí: ' +
      'las fechas religiosas dependen del avistamiento lunar real y pueden diferir un día.',
    buddhist: 'Mismo calendario solar que el gregoriano, con el año contado desde la era budista.',
    indian: 'Calendario nacional oficial. En el día a día se usa el gregoriano.',
    japanese: 'Mismo calendario que el gregoriano, con los años contados por era imperial.',
  },
  unknownCountry: 'ese país',
};

const ENGLISH: Messages = {
  statusLabel: {
    AVAILABLE: 'Available',
    OFF_HOURS: 'Off hours',
    LOCAL_WEEKEND: 'Weekend',
    LOCAL_HOLIDAY: 'Holiday',
    UNKNOWN: 'No data',
  },
  statusLabelDetail: {
    AVAILABLE: 'Available now',
    OFF_HOURS: 'Off hours',
    LOCAL_WEEKEND: 'Local weekend',
    LOCAL_HOLIDAY: 'Local holiday',
    UNKNOWN: 'Not enough data',
  },
  weekendIn: (country) => `Weekend in ${country}`,
  holidayIn: (country, holiday) => `Holiday in ${country}: ${holiday}`,
  noHolidayData: (country) => `No holiday data for ${country}`,
  workingUntil: (time) => `Working until ${time}`,
  startsAt: (time) => `Starts at ${time}`,
  finishedAt: (time) => `Finished at ${time}`,
  weekdayAbbreviation: {
    sunday: 'Sun',
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
  },
  rangeJoin: 'to',
  pairJoin: 'and',
  everyDay: 'every day',
  noDays: '—',
  hoursRange: (start, end) => `${start} to ${end}`,
  calendarLabel: {
    hebrew: 'Hebrew',
    ethiopic: 'Ethiopic',
    persian: 'Persian',
    'islamic-umalqura': 'Hijri (Umm al-Qura)',
    buddhist: 'Buddhist',
    indian: 'Saka',
    japanese: 'Japanese',
  },
  calendarNote: {
    hebrew: 'The day starts at sunset, not at midnight.',
    ethiopic: 'The year has 13 months and starts in September of the Gregorian calendar.',
    persian: 'The year starts at the March equinox (Nowruz).',
    'islamic-umalqura':
      'The day starts at sunset. Umm al-Qura is the official Saudi tabular variant: ' +
      'religious dates depend on actual moon sighting and can differ by a day.',
    buddhist:
      'The same solar calendar as the Gregorian one, with years counted from the Buddhist era.',
    indian: 'The official national calendar. Day to day, the Gregorian one is used.',
    japanese: 'The same calendar as the Gregorian one, with years counted by imperial era.',
  },
  unknownCountry: 'that country',
};

const CATALOGS: Readonly<Record<Locale, Messages>> = {
  es: SPANISH,
  en: ENGLISH,
};

export function messagesFor(locale: Locale): Messages {
  return CATALOGS[locale];
}

/**
 * Picks a supported locale from an `Accept-Language` header.
 *
 * Deliberately simple: the header is walked in the order the client sent it and the
 * first supported primary subtag wins. Quality values are ignored, because clients
 * that care about ordering already send their preference first.
 */
export function resolveLocale(header: string | null | undefined): Locale {
  if (typeof header !== 'string') return DEFAULT_LOCALE;

  for (const entry of header.split(',')) {
    const tag = entry.split(';')[0]?.trim().toLowerCase() ?? '';
    const primary = tag.split('-')[0] ?? '';
    if (primary === 'es') return 'es';
    if (primary === 'en') return 'en';
  }
  return DEFAULT_LOCALE;
}

/** BCP 47 tag handed to `Intl` for dates and country names. */
export function intlTag(locale: Locale): string {
  if (locale === 'es') return 'es-ES';
  return 'en-US';
}
