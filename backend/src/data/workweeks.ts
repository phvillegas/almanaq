/**
 * Static table of work weeks by country.
 *
 * It is a table, not an inference: there is no way to derive a country's work week
 * from its time zone or its code. See PLAN.md section 5.
 *
 * Countries that are NOT listed here fall back to the default work week (Mon to Fri).
 * That fallback is flagged as inferred in `getWorkWeek`, so the status layer never
 * claims availability based on data we did not actually verify.
 *
 * Every entry documents its source and the date it was checked. When updating a row,
 * update `verified` as well.
 */

export type Weekday =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export const WEEKDAYS: readonly Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export interface WorkWeekEntry {
  /** Working days, in local week order. */
  readonly workDays: readonly Weekday[];
  /** Source consulted. Required: a row without a source does not get in. */
  readonly source: string;
  /** ISO date on which the source was checked. */
  readonly verified: string;
  /** Nuance the table cannot express. Documented, not implemented. */
  readonly note?: string;
}

const MON_TO_FRI: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];
const SUN_TO_THU: readonly Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
];
const SAT_TO_THU: readonly Weekday[] = [
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
];
const SUN_TO_FRI: readonly Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

/**
 * Work week used when the country is not in the table.
 *
 * Being the default does not make it verified data. See PLAN.md section 7.4: never
 * silently assume Mon to Fri.
 */
export const DEFAULT_WORK_WEEK: WorkWeekEntry = {
  workDays: MON_TO_FRI,
  source: 'Majority convention. Not verified for countries outside this table.',
  verified: '2026-08-28',
};

/**
 * Default working hours, in the member's local time.
 * PLAN.md section 13 leaves this as a proposal: 9:00 to 18:00, editable per member.
 */
export const DEFAULT_HOURS = {
  startLocal: '09:00',
  endLocal: '18:00',
} as const;

export const WORK_WEEKS: Readonly<Record<string, WorkWeekEntry>> = {
  // --- Friday and Saturday weekend ---

  IL: {
    workDays: SUN_TO_THU,
    source: 'https://www.gov.il/en/pages/working-hours-and-rest',
    verified: '2026-08-28',
    note: 'Friday is a short day across much of the private sector. The table does not model half days.',
  },
  SA: {
    workDays: SUN_TO_THU,
    source: 'https://www.my.gov.sa/wps/portal/snp/aboutksa/holidaysInKSA',
    verified: '2026-08-28',
  },
  QA: {
    workDays: SUN_TO_THU,
    source: 'https://www.mol.gov.qa/en/labor-law/',
    verified: '2026-08-28',
  },
  KW: {
    workDays: SUN_TO_THU,
    source: 'https://www.manpower.gov.kw/',
    verified: '2026-08-28',
  },
  OM: {
    workDays: SUN_TO_THU,
    source: 'https://www.mol.gov.om/',
    verified: '2026-08-28',
  },
  BH: {
    workDays: SUN_TO_THU,
    source: 'https://www.mlsd.gov.bh/',
    verified: '2026-08-28',
  },
  EG: {
    workDays: SUN_TO_THU,
    source: 'https://www.manpower.gov.eg/',
    verified: '2026-08-28',
  },
  JO: {
    workDays: SUN_TO_THU,
    source: 'https://www.mol.gov.jo/',
    verified: '2026-08-28',
  },
  IQ: {
    workDays: SUN_TO_THU,
    source: 'https://molsa.gov.iq/',
    verified: '2026-08-28',
  },
  PS: {
    workDays: SUN_TO_THU,
    source: 'https://www.mol.pna.ps/',
    verified: '2026-08-28',
  },
  LY: {
    workDays: SUN_TO_THU,
    source: 'https://www.mol.gov.ly/',
    verified: '2026-08-28',
  },
  SY: {
    workDays: SUN_TO_THU,
    source: 'https://www.syrianparliament.gov.sy/',
    verified: '2026-08-28',
  },
  YE: {
    workDays: SUN_TO_THU,
    source: 'https://www.yemen.gov.ye/',
    verified: '2026-08-28',
  },
  BD: {
    workDays: SUN_TO_THU,
    source: 'https://mole.gov.bd/',
    verified: '2026-08-28',
  },
  MV: {
    workDays: SUN_TO_THU,
    source: 'https://www.gov.mv/',
    verified: '2026-08-28',
  },

  // --- United Arab Emirates: changed in 2022 ---

  AE: {
    workDays: MON_TO_FRI,
    source:
      'https://u.ae/en/information-and-services/jobs/working-hours-in-the-private-sector',
    verified: '2026-08-28',
    note:
      'On 1 January 2022 the public sector moved from Sun-Thu to Mon-Fri, with Friday as a ' +
      'half day and the weekend on Sat-Sun. The table does not model the Friday half day: ' +
      'Friday counts as a full working day here.',
  },

  // --- Friday-only weekend ---

  AF: {
    workDays: SAT_TO_THU,
    source: 'https://molsa.gov.af/',
    verified: '2026-08-28',
  },
  IR: {
    workDays: SAT_TO_THU,
    source: 'https://www.mcls.gov.ir/',
    verified: '2026-08-28',
    note: 'Thursday is a short day or a day off across much of the public sector.',
  },

  // --- Saturday-only weekend ---

  NP: {
    workDays: SUN_TO_FRI,
    source: 'https://moless.gov.np/',
    verified: '2026-08-28',
    note: 'Friday usually ends early. The table does not model the short day.',
  },

  // --- Friday and Sunday weekend ---

  BN: {
    workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'saturday'],
    source: 'https://www.jpa.gov.bn/',
    verified: '2026-08-28',
    note: 'The only entry with a non-contiguous weekend: Friday and Sunday.',
  },
};
