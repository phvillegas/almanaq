/**
 * Conversión de un instante UTC a la realidad local de un miembro: hora, fecha, día
 * de la semana, offset y calendario local.
 *
 * Todo pasa por `Intl` (ICU nativo de Node). No hay aritmética de fechas a mano.
 *
 * REGLA QUE NO SE CRUZA: ninguna función de este módulo formatea sin `timeZone`
 * explícito. Sin él, ICU usa el huso del proceso y la fecha se corre un día en
 * cualquier servidor con offset distinto al del miembro. El snippet de verificación
 * de SETUP.md sección 2 tiene justamente ese error: `new Date('2026-08-17')` es
 * medianoche UTC, y formateado en un huso negativo devuelve el 16.
 *
 * Documentado el 2026-08-28.
 */

/** Sistemas de calendario de ICU que usamos. Ver PLAN.md sección 5. */
export type SistemaCalendario =
  | 'hebrew'
  | 'ethiopic'
  | 'persian'
  | 'islamic-umalqura'
  | 'buddhist'
  | 'indian'
  | 'japanese';

export interface CalendarioLocal {
  readonly system: SistemaCalendario;
  readonly label: string;
  /** Año local ya formateado. Puede incluir era, como en el calendario japonés. */
  readonly currentYear: string;
  /** Matiz que cambia cómo interpretar las fechas. `null` si no hay nada que aclarar. */
  readonly note: string | null;
}

export interface PartesLocales {
  /** "18:42", 24 horas. */
  readonly localTime: string;
  /** "2026-08-21", fecha gregoriana local. */
  readonly localDate: string;
  readonly localWeekday: DiaSemanaLocal;
  readonly utcOffsetMinutes: number;
}

export type DiaSemanaLocal =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

interface EntradaCalendario {
  readonly system: SistemaCalendario;
  readonly label: string;
  readonly note: string | null;
  readonly fuente: string;
  readonly verificado: string;
}

/**
 * Países con calendario local propio que ICU sabe convertir.
 *
 * Criterio de entrada: el calendario tiene uso civil u oficial en el país, no
 * solamente religioso. Un país que no está acá muestra solo el gregoriano.
 *
 * Deliberadamente AFUERA:
 *
 * - NP (bikram sambat) y BD (bengalí): ICU no los trae. PLAN.md sección 5 los lista
 *   como faltantes conocidos. Devolver `null` antes que aproximar con otro sistema.
 * - CN, TW, KR, VN: el calendario civil es el gregoriano; el lunar solo rige feriados.
 *   Además ICU los formatea sin nombres de mes en español (devuelve "4-7-2026"), así
 *   que la etiqueta quedaría inservible. Y son tres sistemas distintos con el mismo
 *   origen: unificarlos daría fechas equivocadas. Ver PLAN.md sección 5, trampa 3.
 */
const CALENDARIOS_POR_PAIS: Readonly<Record<string, EntradaCalendario>> = {
  IL: {
    system: 'hebrew',
    label: 'Hebreo',
    note: 'El día empieza al atardecer, no a medianoche.',
    fuente: 'https://www.gov.il/en/departments/topics/jewish_holidays',
    verificado: '2026-08-28',
  },
  ET: {
    system: 'ethiopic',
    label: 'Etíope',
    note: 'El año tiene 13 meses y arranca en septiembre del calendario gregoriano.',
    fuente: 'https://www.ethiopianembassy.org/',
    verificado: '2026-08-28',
  },
  IR: {
    system: 'persian',
    label: 'Persa',
    note: 'El año arranca en el equinoccio de marzo (Nouruz).',
    fuente: 'https://www.timeanddate.com/calendar/persian-calendar.html',
    verificado: '2026-08-28',
  },
  AF: {
    system: 'persian',
    label: 'Persa',
    note: 'El año arranca en el equinoccio de marzo (Nouruz).',
    fuente: 'https://www.timeanddate.com/calendar/persian-calendar.html',
    verificado: '2026-08-28',
  },
  SA: {
    system: 'islamic-umalqura',
    label: 'Hiyrí (Um al-Qura)',
    note:
      'El día empieza al atardecer. Um al-Qura es la variante tabular oficial saudí: ' +
      'las fechas religiosas dependen del avistamiento lunar real y pueden diferir un día.',
    fuente: 'https://www.ummulqura.org.sa/',
    verificado: '2026-08-28',
  },
  TH: {
    system: 'buddhist',
    label: 'Budista',
    note: 'Mismo calendario solar que el gregoriano, con el año contado desde la era budista.',
    fuente: 'https://www.thaiembassy.com/',
    verificado: '2026-08-28',
  },
  JP: {
    system: 'japanese',
    label: 'Japonés',
    note: 'Mismo calendario que el gregoriano, con los años contados por era imperial.',
    fuente: 'https://www.japan.go.jp/',
    verificado: '2026-08-28',
  },
  IN: {
    system: 'indian',
    label: 'Saka',
    note: 'Calendario nacional oficial. En el día a día se usa el gregoriano.',
    fuente: 'https://www.india.gov.in/',
    verificado: '2026-08-28',
  },
};

const DIAS_EN: readonly DiaSemanaLocal[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/** ¿Es un identificador de huso IANA que este runtime conoce? */
export function esZonaValida(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Convierte un instante UTC a las partes locales del miembro.
 *
 * Lanza si el huso es inválido: es un error de datos del cliente, no un caso a
 * silenciar con un valor por defecto.
 */
export function partesLocales(instante: Date, timeZone: string): PartesLocales {
  if (!esZonaValida(timeZone)) {
    throw new RangeError(`Huso horario desconocido: ${timeZone}`);
  }

  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone,
    calendar: 'gregory',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante);

  const buscar = (tipo: Intl.DateTimeFormatPartTypes): string =>
    partes.find((p) => p.type === tipo)?.value ?? '';

  const anio = buscar('year').padStart(4, '0');
  const mes = buscar('month');
  const dia = buscar('day');
  const hora = buscar('hour');
  const minuto = buscar('minute');
  const diaSemana = buscar('weekday').toLowerCase() as DiaSemanaLocal;

  return {
    localTime: `${hora}:${minuto}`,
    localDate: `${anio}-${mes}-${dia}`,
    localWeekday: DIAS_EN.includes(diaSemana) ? diaSemana : 'monday',
    utcOffsetMinutes: offsetEnMinutos(instante, timeZone),
  };
}

/**
 * Offset del huso respecto de UTC, en minutos, para ese instante.
 *
 * Se calcula por instante y no por zona porque el offset cambia con el horario de
 * verano. Ver PLAN.md sección 5, trampa 4.
 */
export function offsetEnMinutos(instante: Date, timeZone: string): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(instante);

  const texto = partes.find((p) => p.type === 'timeZoneName')?.value ?? '';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(texto);
  if (!match) return 0; // "GMT" a secas es UTC.

  const signo = match[1] === '-' ? -1 : 1;
  return signo * (Number(match[2]) * 60 + Number(match[3]));
}

/** "viernes 21 de agosto". Sin año y sin coma, como pide el contrato. */
export function fechaLargaLocal(instante: Date, timeZone: string): string {
  const partes = new Intl.DateTimeFormat('es-ES', {
    timeZone,
    calendar: 'gregory',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).formatToParts(instante);

  const buscar = (tipo: Intl.DateTimeFormatPartTypes): string =>
    partes.find((p) => p.type === tipo)?.value ?? '';

  return `${buscar('weekday')} ${buscar('day')} de ${buscar('month')}`;
}

/**
 * Calendario local del país, con el año ya resuelto para ese instante.
 *
 * Devuelve `null` si el país no tiene calendario propio o si ICU no lo cubre. El
 * cliente oculta la fila entera. No inventar conversiones: PLAN.md sección 5.
 */
export function obtenerCalendarioLocal(
  countryCode: string | null | undefined,
  instante: Date,
  timeZone: string,
): CalendarioLocal | null {
  const codigo = typeof countryCode === 'string' ? countryCode.trim().toUpperCase() : '';
  const entrada = CALENDARIOS_POR_PAIS[codigo];
  if (!entrada) return null;
  if (!esZonaValida(timeZone)) return null;

  return {
    system: entrada.system,
    label: entrada.label,
    currentYear: anioLocal(instante, timeZone, entrada.system),
    note: entrada.note,
  };
}

/**
 * Año en el calendario indicado. Incluye la era cuando aporta ("Reiwa 8"): sin ella
 * el año japonés es un número suelto que no dice nada.
 */
export function anioLocal(
  instante: Date,
  timeZone: string,
  system: SistemaCalendario,
): string {
  const partes = new Intl.DateTimeFormat(`es-u-ca-${system}`, {
    timeZone,
    year: 'numeric',
    era: 'short',
  }).formatToParts(instante);

  const anio = partes.find((p) => p.type === 'year')?.value ?? '';
  if (system !== 'japanese') return anio;

  const era = partes.find((p) => p.type === 'era')?.value ?? '';
  return era ? `${era} ${anio}` : anio;
}

/**
 * Fecha completa en el calendario local, para depuración y para los tests.
 * No la consume ningún endpoint del contrato v1.
 */
export function fechaEnCalendario(
  instante: Date,
  timeZone: string,
  system: SistemaCalendario,
): string {
  return new Intl.DateTimeFormat(`es-u-ca-${system}`, {
    timeZone,
    dateStyle: 'long',
  }).format(instante);
}
