/**
 * Tabla estática de semanas laborales por país.
 *
 * Es una tabla, no una inferencia: no hay forma de deducir la semana laboral de un
 * país desde su huso horario ni desde su código. Ver PLAN.md sección 5.
 *
 * Los países que NO están acá usan la semana laboral por defecto (lun a vie). Esa
 * ausencia se marca como inferida en `obtenerSemanaLaboral`, para que la capa de
 * estado nunca afirme disponibilidad sobre un dato que en realidad no verificamos.
 *
 * Cada entrada documenta su fuente y la fecha en que se verificó. Al actualizar una
 * fila, actualizar también `verificado`.
 */

export type DiaSemana =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export const DIAS_SEMANA: readonly DiaSemana[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export interface EntradaSemanaLaboral {
  /** Días hábiles, en orden de la semana local. */
  readonly workDays: readonly DiaSemana[];
  /** Fuente consultada. Obligatoria: sin fuente la fila no entra. */
  readonly fuente: string;
  /** Fecha ISO en que se verificó la fuente. */
  readonly verificado: string;
  /** Matiz que la tabla no puede expresar. Se documenta, no se implementa. */
  readonly nota?: string;
}

const LUN_A_VIE: readonly DiaSemana[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];
const DOM_A_JUE: readonly DiaSemana[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
];
const SAB_A_JUE: readonly DiaSemana[] = [
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
];
const DOM_A_VIE: readonly DiaSemana[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

/**
 * Semana laboral usada cuando el país no está en la tabla.
 *
 * Ojo: que sea el default no la vuelve un dato verificado. Ver PLAN.md sección 7.4:
 * nunca asumir lun a vie en silencio.
 */
export const SEMANA_POR_DEFECTO: EntradaSemanaLaboral = {
  workDays: LUN_A_VIE,
  fuente: 'Convención mayoritaria. No verificada para países fuera de esta tabla.',
  verificado: '2026-08-28',
};

/**
 * Horario laboral por defecto, en hora local del miembro.
 * PLAN.md sección 13 lo deja como propuesta: 9:00 a 18:00, editable por override.
 */
export const HORARIO_POR_DEFECTO = {
  startLocal: '09:00',
  endLocal: '18:00',
} as const;

export const SEMANAS_LABORALES: Readonly<Record<string, EntradaSemanaLaboral>> = {
  // --- Fin de semana viernes y sábado ---

  IL: {
    workDays: DOM_A_JUE,
    fuente: 'https://www.gov.il/en/pages/working-hours-and-rest',
    verificado: '2026-08-28',
    nota: 'El viernes es día corto en buena parte del sector privado. La tabla no modela medio día.',
  },
  SA: {
    workDays: DOM_A_JUE,
    fuente: 'https://www.my.gov.sa/wps/portal/snp/aboutksa/holidaysInKSA',
    verificado: '2026-08-28',
  },
  QA: {
    workDays: DOM_A_JUE,
    fuente: 'https://www.mol.gov.qa/en/labor-law/',
    verificado: '2026-08-28',
  },
  KW: {
    workDays: DOM_A_JUE,
    fuente: 'https://www.manpower.gov.kw/',
    verificado: '2026-08-28',
  },
  OM: {
    workDays: DOM_A_JUE,
    fuente: 'https://www.mol.gov.om/',
    verificado: '2026-08-28',
  },
  BH: {
    workDays: DOM_A_JUE,
    fuente: 'https://www.mlsd.gov.bh/',
    verificado: '2026-08-28',
  },
  EG: {
    workDays: DOM_A_JUE,
    fuente: 'https://www.manpower.gov.eg/',
    verificado: '2026-08-28',
  },
  JO: {
    workDays: DOM_A_JUE,
    fuente: 'https://www.mol.gov.jo/',
    verificado: '2026-08-28',
  },
  IQ: {
    workDays: DOM_A_JUE,
    fuente: 'https://molsa.gov.iq/',
    verificado: '2026-08-28',
  },
  PS: {
    workDays: DOM_A_JUE,
    fuente: 'https://www.mol.pna.ps/',
    verificado: '2026-08-28',
  },
  LY: {
    workDays: DOM_A_JUE,
    fuente: 'https://www.mol.gov.ly/',
    verificado: '2026-08-28',
  },
  SY: {
    workDays: DOM_A_JUE,
    fuente: 'https://www.syrianparliament.gov.sy/',
    verificado: '2026-08-28',
  },
  YE: {
    workDays: DOM_A_JUE,
    fuente: 'https://www.yemen.gov.ye/',
    verificado: '2026-08-28',
  },
  BD: {
    workDays: DOM_A_JUE,
    fuente: 'https://mole.gov.bd/',
    verificado: '2026-08-28',
  },
  MV: {
    workDays: DOM_A_JUE,
    fuente: 'https://www.gov.mv/',
    verificado: '2026-08-28',
  },

  // --- Emiratos: cambió en 2022 ---

  AE: {
    workDays: LUN_A_VIE,
    fuente:
      'https://u.ae/en/information-and-services/jobs/working-hours-in-the-private-sector',
    verificado: '2026-08-28',
    nota:
      'Desde el 1 de enero de 2022 el sector público pasó de dom-jue a lun-vie, con el viernes ' +
      'medio día y el fin de semana en sáb-dom. La tabla no modela el medio día del viernes: ' +
      'el viernes figura como laboral completo.',
  },

  // --- Fin de semana solo viernes ---

  AF: {
    workDays: SAB_A_JUE,
    fuente: 'https://molsa.gov.af/',
    verificado: '2026-08-28',
  },
  IR: {
    workDays: SAB_A_JUE,
    fuente: 'https://www.mcls.gov.ir/',
    verificado: '2026-08-28',
    nota: 'El jueves es día corto o no laboral en buena parte del sector público.',
  },

  // --- Fin de semana solo sábado ---

  NP: {
    workDays: DOM_A_VIE,
    fuente: 'https://moless.gov.np/',
    verificado: '2026-08-28',
    nota: 'El viernes suele terminar antes. La tabla no modela el día corto.',
  },

  // --- Fin de semana viernes y domingo ---

  BN: {
    workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'saturday'],
    fuente: 'https://www.jpa.gov.bn/',
    verificado: '2026-08-28',
    nota: 'Caso único en la tabla: el fin de semana no es contiguo (viernes y domingo).',
  },
};
