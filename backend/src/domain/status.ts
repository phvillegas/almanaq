/**
 * Resolución del estado de disponibilidad y redacción de los textos que ve el usuario.
 *
 * Este módulo es el único lugar donde se decide si alguien está disponible. El cliente
 * recibe el enum ya resuelto y los textos ya escritos; no arma ninguno de los dos.
 * Ver PLAN.md sección 4 y CLAUDE.md regla 1.
 */

import {
  fechaLargaLocal,
  obtenerCalendarioLocal,
  partesLocales,
  type CalendarioLocal,
  type DiaSemanaLocal,
  type PartesLocales,
} from './calendars.js';
import { feriadoEnFecha, hayCobertura, proximosFeriados, type Feriado } from './holidays.js';
import {
  esDiaLaboral,
  estaEnHorario,
  etiquetaDias,
  etiquetaFinDeSemana,
  etiquetaHorario,
  obtenerSemanaLaboral,
  type OverridesMiembro,
  type SemanaLaboral,
} from './workweek.js';

export type Estado =
  | 'AVAILABLE'
  | 'OFF_HOURS'
  | 'LOCAL_WEEKEND'
  | 'LOCAL_HOLIDAY'
  | 'UNKNOWN';

/** Lo mínimo que el backend necesita de un miembro para resolver su estado. */
export interface MiembroEntrada {
  readonly countryCode: string | null;
  readonly timezone: string;
  readonly overrides?: OverridesMiembro | null;
}

export interface EstadoResuelto extends PartesLocales {
  readonly status: Estado;
  readonly statusLabel: string;
  readonly statusDetail: string;
  readonly semana: SemanaLaboral;
  readonly feriado: Feriado | null;
}

export interface ConflictoDia {
  readonly reason: Extract<Estado, 'LOCAL_WEEKEND' | 'LOCAL_HOLIDAY' | 'UNKNOWN'>;
  readonly detail: string;
}

export interface DetalleMiembro {
  readonly localTime: string;
  readonly localDateFormatted: string;
  readonly utcOffsetMinutes: number;
  readonly status: Estado;
  readonly statusLabel: string;
  readonly workWeek: {
    readonly daysLabel: string;
    readonly weekendLabel: string;
    readonly hoursLabel: string;
  };
  readonly localCalendar: CalendarioLocal | null;
  readonly upcomingHolidays: readonly {
    readonly name: string;
    readonly dateLabel: string;
    readonly startDate: string;
  }[];
}

const ETIQUETAS: Readonly<Record<Estado, string>> = {
  AVAILABLE: 'Disponible',
  OFF_HOURS: 'Fuera de horario',
  LOCAL_WEEKEND: 'Fin de semana',
  LOCAL_HOLIDAY: 'Feriado',
  UNKNOWN: 'Sin datos',
};

/** Etiquetas de la pantalla de detalle, que tiene más lugar que una fila de lista. */
const ETIQUETAS_DETALLE: Readonly<Record<Estado, string>> = {
  AVAILABLE: 'Disponible ahora',
  OFF_HOURS: 'Fuera de horario',
  LOCAL_WEEKEND: 'Fin de semana local',
  LOCAL_HOLIDAY: 'Feriado local',
  UNKNOWN: 'Sin datos suficientes',
};

const NOMBRES_PAIS = new Intl.DisplayNames(['es'], { type: 'region' });

/**
 * Resuelve el estado de un miembro en un instante dado.
 *
 * Orden de decisión, de más firme a menos:
 *
 * 1. Día no laboral según la tabla explícita (o según un override) → `LOCAL_WEEKEND`.
 *    Gana incluso sin cobertura de feriados y aunque además sea feriado: el dato de
 *    fin de semana es el más confiable que tenemos y al usuario el motivo le da igual.
 * 2. Feriado en el archivo del país → `LOCAL_HOLIDAY`.
 * 3. Sin cobertura de feriados para esa fecha → `UNKNOWN`. Nunca `AVAILABLE`:
 *    afirmar que alguien trabaja un día que podría ser feriado es exactamente el
 *    dato equivocado que PLAN.md sección 10 regla 3 prohíbe.
 * 4. Día no laboral según el default lun a vie → `LOCAL_WEEKEND`. Acá ya sabemos que
 *    hay cobertura de feriados del país, así que no es un país desconocido: es un país
 *    que cae en la regla mayoritaria documentada en PLAN.md sección 5.
 * 5. Día laboral y hora dentro del horario → `AVAILABLE`; si no, `OFF_HOURS`.
 *
 * Lo que sostiene todo el orden es que la cobertura de feriados es el único portón
 * hacia `AVAILABLE`. Sin ella nunca se afirma que alguien está trabajando.
 */
export function resolverEstado(miembro: MiembroEntrada, instante: Date): EstadoResuelto {
  const partes = partesLocales(instante, miembro.timezone);
  const semana = obtenerSemanaLaboral(miembro.countryCode, miembro.overrides);
  const pais = nombreDePais(miembro.countryCode);

  const cobertura = hayCobertura(miembro.countryCode, partes.localDate);
  const feriado = cobertura ? feriadoEnFecha(miembro.countryCode, partes.localDate) : null;

  const { status, statusDetail } = decidir({
    dia: partes.localWeekday,
    hora: partes.localTime,
    semana,
    cobertura,
    feriado,
    pais,
  });

  return {
    ...partes,
    status,
    statusLabel: ETIQUETAS[status],
    statusDetail,
    semana,
    feriado,
  };
}

/**
 * Conflicto de un miembro en una fecha del calendario, sin hora.
 *
 * La fecha se evalúa como fecha local del miembro: es la fecha de la reunión que el
 * usuario está eligiendo, no un instante que haya que convertir de huso. Por eso acá
 * no existen `AVAILABLE` ni `OFF_HOURS`: sin hora no hay horario laboral que evaluar.
 *
 * Devuelve `null` cuando el día está limpio. La vista de mes solo pinta los días con
 * conflicto. Ver PLAN.md sección 4, `POST /v1/calendar`.
 */
export function resolverConflictoDelDia(
  miembro: MiembroEntrada,
  fechaISO: string,
): ConflictoDia | null {
  const semana = obtenerSemanaLaboral(miembro.countryCode, miembro.overrides);
  const pais = nombreDePais(miembro.countryCode);
  const dia = diaSemanaDeFecha(fechaISO);

  const cobertura = hayCobertura(miembro.countryCode, fechaISO);
  const feriado = cobertura ? feriadoEnFecha(miembro.countryCode, fechaISO) : null;

  if (!semana.inferida && !esDiaLaboral(semana, dia)) {
    return { reason: 'LOCAL_WEEKEND', detail: `Fin de semana en ${pais}` };
  }
  if (feriado) {
    return { reason: 'LOCAL_HOLIDAY', detail: `Feriado en ${pais}: ${nombreDeFeriado(feriado)}` };
  }
  if (!cobertura) {
    return { reason: 'UNKNOWN', detail: `Sin datos de feriados en ${pais}` };
  }
  if (!esDiaLaboral(semana, dia)) {
    return { reason: 'LOCAL_WEEKEND', detail: `Fin de semana en ${pais}` };
  }
  return null;
}

/** Arma la respuesta de `POST /v1/member/detail`. */
export function resolverDetalle(miembro: MiembroEntrada, instante: Date): DetalleMiembro {
  const resuelto = resolverEstado(miembro, instante);

  return {
    localTime: resuelto.localTime,
    localDateFormatted: fechaLargaLocal(instante, miembro.timezone),
    utcOffsetMinutes: resuelto.utcOffsetMinutes,
    status: resuelto.status,
    statusLabel: ETIQUETAS_DETALLE[resuelto.status],
    workWeek: {
      daysLabel: etiquetaDias(resuelto.semana),
      weekendLabel: etiquetaFinDeSemana(resuelto.semana),
      hoursLabel: etiquetaHorario(resuelto.semana),
    },
    localCalendar: obtenerCalendarioLocal(miembro.countryCode, instante, miembro.timezone),
    upcomingHolidays: proximosFeriados(miembro.countryCode, resuelto.localDate, 3).map((f) => ({
      name: nombreDeFeriado(f),
      dateLabel: fechaLargaLocal(new Date(`${f.date}T12:00:00Z`), 'UTC'),
      startDate: f.date,
    })),
  };
}

function decidir(entrada: {
  dia: DiaSemanaLocal;
  hora: string;
  semana: SemanaLaboral;
  cobertura: boolean;
  feriado: Feriado | null;
  pais: string;
}): { status: Estado; statusDetail: string } {
  const { dia, hora, semana, cobertura, feriado, pais } = entrada;

  if (!semana.inferida && !esDiaLaboral(semana, dia)) {
    return { status: 'LOCAL_WEEKEND', statusDetail: `Fin de semana en ${pais}` };
  }
  if (feriado) {
    return {
      status: 'LOCAL_HOLIDAY',
      statusDetail: `Feriado en ${pais}: ${nombreDeFeriado(feriado)}`,
    };
  }
  if (!cobertura) {
    return { status: 'UNKNOWN', statusDetail: `Sin datos de feriados en ${pais}` };
  }
  if (!esDiaLaboral(semana, dia)) {
    // País fuera de la tabla, pero con feriados cubiertos: aplica la regla mayoritaria.
    return { status: 'LOCAL_WEEKEND', statusDetail: `Fin de semana en ${pais}` };
  }
  if (estaEnHorario(semana, hora)) {
    return {
      status: 'AVAILABLE',
      statusDetail: `En horario hasta las ${sinCeroInicial(semana.endLocal)}`,
    };
  }
  return {
    status: 'OFF_HOURS',
    statusDetail:
      hora < semana.startLocal
        ? `Empieza a las ${sinCeroInicial(semana.startLocal)}`
        : `Terminó a las ${sinCeroInicial(semana.endLocal)}`,
  };
}

/**
 * Nombre del feriado tal como lo trae el proveedor.
 *
 * LIMITACIÓN CONOCIDA: no está traducido al español. Nager.Date devuelve el nombre en
 * inglés y el local en el idioma del país. Se prefiere el inglés porque el local viene
 * en alfabetos que el usuario hispanohablante no lee (amárico, hebreo, tailandés).
 * Traducirlos exigiría una tabla mantenida a mano y es la clase de dato que PLAN.md
 * sección 10 regla 3 prefiere no inventar.
 */
function nombreDeFeriado(feriado: Feriado): string {
  return feriado.name || feriado.localName || 'Feriado';
}

function nombreDePais(countryCode: string | null | undefined): string {
  if (typeof countryCode !== 'string') return 'ese país';
  const codigo = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(codigo)) return 'ese país';
  try {
    return NOMBRES_PAIS.of(codigo) ?? codigo;
  } catch {
    return codigo;
  }
}

/**
 * Día de la semana de una fecha "YYYY-MM-DD", leída como fecha civil.
 *
 * Se ancla a mediodía UTC a propósito: con medianoche, cualquier formateo en un huso
 * negativo devolvería el día anterior. Es el mismo error del snippet de SETUP.md.
 */
function diaSemanaDeFecha(fechaISO: string): DiaSemanaLocal {
  return partesLocales(new Date(`${fechaISO}T12:00:00Z`), 'UTC').localWeekday;
}

function sinCeroInicial(hora: string): string {
  return hora.replace(/^0/, '');
}
