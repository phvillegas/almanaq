/**
 * Semana laboral de un miembro: resolución de la tabla estática, aplicación de
 * overrides manuales y redacción de las etiquetas que consume la pantalla de detalle.
 *
 * Este módulo no sabe nada de husos horarios ni de feriados. Recibe un día de la
 * semana y una hora ya expresados en la zona local del miembro. La conversión vive
 * en `calendars.ts`.
 */

import {
  DIAS_SEMANA,
  HORARIO_POR_DEFECTO,
  SEMANAS_LABORALES,
  SEMANA_POR_DEFECTO,
  type DiaSemana,
} from '../data/workweeks.js';

/** Overrides manuales del usuario. `null` significa "usar el valor del país". */
export interface OverridesMiembro {
  readonly workDays?: readonly DiaSemana[] | null;
  readonly workStartLocal?: string | null;
  readonly workEndLocal?: string | null;
}

export interface SemanaLaboral {
  readonly workDays: readonly DiaSemana[];
  /** Hora local de inicio, formato "HH:MM". */
  readonly startLocal: string;
  /** Hora local de fin, formato "HH:MM". */
  readonly endLocal: string;
  /**
   * `true` cuando el país no está en la tabla y se cayó al default lun a vie.
   *
   * La capa de estado usa esto para no afirmar disponibilidad sobre un dato que no
   * verificamos. Ver PLAN.md sección 7.4.
   */
  readonly inferida: boolean;
  /** `true` si el usuario corrigió algo a mano. Un override siempre gana. */
  readonly conOverrides: boolean;
  readonly nota?: string;
}

const ABREVIATURAS: Readonly<Record<DiaSemana, string>> = {
  sunday: 'dom',
  monday: 'lun',
  tuesday: 'mar',
  wednesday: 'mié',
  thursday: 'jue',
  friday: 'vie',
  saturday: 'sáb',
};

const HORA_VALIDA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Orden usado solo para redactar etiquetas.
 *
 * Empieza el lunes, igual que la grilla del calendario (PLAN.md sección 7.2). El
 * modelo de datos sigue usando `DIAS_SEMANA`, que arranca el domingo por convención
 * de ICU. Redactar desde el lunes hace que los tramos caigan donde el lector los
 * espera: el fin de semana de Brunéi sale "vie y dom" y no "dom y vie".
 */
const ORDEN_ETIQUETA: readonly DiaSemana[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/**
 * Resuelve la semana laboral efectiva de un miembro.
 *
 * Precedencia: override manual > tabla del país > default lun a vie.
 * Un override parcial (solo el horario, por ejemplo) deja el resto en el valor del país.
 */
export function obtenerSemanaLaboral(
  countryCode: string | null | undefined,
  overrides?: OverridesMiembro | null,
): SemanaLaboral {
  const codigo = normalizarPais(countryCode);
  const entrada = (codigo && SEMANAS_LABORALES[codigo]) || SEMANA_POR_DEFECTO;
  const inferida = !codigo || SEMANAS_LABORALES[codigo] === undefined;

  const diasOverride = normalizarDias(overrides?.workDays);
  const inicioOverride = normalizarHora(overrides?.workStartLocal);
  const finOverride = normalizarHora(overrides?.workEndLocal);
  const conOverrides =
    diasOverride !== null || inicioOverride !== null || finOverride !== null;

  return {
    workDays: diasOverride ?? entrada.workDays,
    startLocal: inicioOverride ?? HORARIO_POR_DEFECTO.startLocal,
    endLocal: finOverride ?? HORARIO_POR_DEFECTO.endLocal,
    // Un override de días vuelve el dato explícito: ya no es una inferencia nuestra.
    inferida: inferida && diasOverride === null,
    conOverrides,
    ...(entrada.nota !== undefined && diasOverride === null ? { nota: entrada.nota } : {}),
  };
}

export function esDiaLaboral(semana: SemanaLaboral, dia: DiaSemana): boolean {
  return semana.workDays.includes(dia);
}

/**
 * ¿La hora local cae dentro del horario laboral?
 *
 * `horaLocal` viene en formato "HH:MM" de 24 horas. El intervalo es cerrado al
 * inicio y abierto al final: a las 18:00 en punto ya no se está disponible.
 *
 * Si el fin es menor o igual que el inicio se interpreta que el turno cruza la
 * medianoche. No es un caso del alcance v1, pero un override manual puede producirlo.
 */
export function estaEnHorario(semana: SemanaLaboral, horaLocal: string): boolean {
  const ahora = aMinutos(horaLocal);
  const inicio = aMinutos(semana.startLocal);
  const fin = aMinutos(semana.endLocal);
  if (ahora === null || inicio === null || fin === null) return false;
  return inicio < fin ? ahora >= inicio && ahora < fin : ahora >= inicio || ahora < fin;
}

/** Etiqueta de días hábiles: "dom a jue", "lun a jue y sáb". */
export function etiquetaDias(semana: SemanaLaboral): string {
  return etiquetaDeConjunto(semana.workDays);
}

/** Etiqueta de fin de semana: "vie y sáb", "vie y dom". */
export function etiquetaFinDeSemana(semana: SemanaLaboral): string {
  const libres = DIAS_SEMANA.filter((d) => !semana.workDays.includes(d));
  return etiquetaDeConjunto(libres);
}

/** Etiqueta de horario: "9:00 a 18:00". Sin cero a la izquierda. */
export function etiquetaHorario(semana: SemanaLaboral): string {
  return `${sinCeroInicial(semana.startLocal)} a ${sinCeroInicial(semana.endLocal)}`;
}

/**
 * Agrupa los días en tramos contiguos y los redacta.
 *
 * La contigüidad es cíclica: sábado y domingo son un solo tramo aunque estén en las
 * puntas del array. Un tramo de dos días se une con "y"; de tres o más, con "a".
 */
function etiquetaDeConjunto(dias: readonly DiaSemana[]): string {
  const total = ORDEN_ETIQUETA.length;
  const presentes = ORDEN_ETIQUETA.filter((d) => dias.includes(d));
  if (presentes.length === 0) return '—';
  if (presentes.length === total) return 'todos los días';

  const indices = presentes.map((d) => ORDEN_ETIQUETA.indexOf(d));
  // Arrancar después de un hueco, para que un tramo cíclico no quede partido en dos.
  const arranque =
    indices.find((i) => !indices.includes((i + total - 1) % total)) ?? indices[0]!;

  const tramos: DiaSemana[][] = [];
  let actual: DiaSemana[] = [];
  for (let paso = 0; paso < total; paso++) {
    const indice = (arranque + paso) % total;
    const dia = ORDEN_ETIQUETA[indice]!;
    if (indices.includes(indice)) {
      actual.push(dia);
    } else if (actual.length > 0) {
      tramos.push(actual);
      actual = [];
    }
  }
  if (actual.length > 0) tramos.push(actual);

  return tramos.map(redactarTramo).join(' y ');
}

function redactarTramo(tramo: readonly DiaSemana[]): string {
  const primero = ABREVIATURAS[tramo[0]!];
  if (tramo.length === 1) return primero;
  const ultimo = ABREVIATURAS[tramo[tramo.length - 1]!];
  return tramo.length === 2 ? `${primero} y ${ultimo}` : `${primero} a ${ultimo}`;
}

function normalizarPais(countryCode: string | null | undefined): string | null {
  if (typeof countryCode !== 'string') return null;
  const codigo = countryCode.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(codigo) ? codigo : null;
}

function normalizarDias(
  dias: readonly DiaSemana[] | null | undefined,
): readonly DiaSemana[] | null {
  if (!Array.isArray(dias) || dias.length === 0) return null;
  const validos = DIAS_SEMANA.filter((d) => dias.includes(d));
  return validos.length > 0 ? validos : null;
}

function normalizarHora(hora: string | null | undefined): string | null {
  return typeof hora === 'string' && HORA_VALIDA.test(hora) ? hora : null;
}

function aMinutos(hora: string): number | null {
  const partes = HORA_VALIDA.exec(hora);
  if (!partes) return null;
  return Number(partes[1]) * 60 + Number(partes[2]);
}

function sinCeroInicial(hora: string): string {
  return hora.replace(/^0/, '');
}
