/**
 * Validación y normalización de lo que llega por HTTP.
 *
 * Las tres rutas que reciben equipos comparten el mismo parseo de miembros, así que
 * vive acá y no repetido en cada una.
 *
 * Criterio: rechazar temprano y con un mensaje que diga qué campo está mal. El backend
 * no tiene estado ni autenticación, así que el cuerpo del request es todo lo que hay;
 * si viene mal, no hay nada que suponer.
 *
 * NOTA DE ESTRUCTURA: este archivo no está en la lista de SETUP.md sección 2.
 */

import { esZonaValida } from '../domain/calendars.js';
import type { DiaSemana } from '../data/workweeks.js';
import type { MiembroEntrada } from '../domain/status.js';

/** Tope de miembros por request. Un equipo real no llega ni cerca. */
const MAXIMO_MIEMBROS = 200;
/** Tope de días por consulta de calendario: poco más de un año. */
const MAXIMO_DIAS = 366;

const DIAS_VALIDOS: readonly string[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export type CodigoError = 'INVALID_BODY' | 'INVALID_MEMBER' | 'INVALID_RANGE';

export class ErrorDeEntrada extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorDeEntrada';
  }
}

/** Miembro ya validado, con el `id` que el cliente usa para volver a encontrarlo. */
export interface MiembroConId extends MiembroEntrada {
  readonly id: string;
}

export function comoObjeto(valor: unknown, campo: string): Record<string, unknown> {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new ErrorDeEntrada('INVALID_BODY', `${campo} tiene que ser un objeto`);
  }
  return valor as Record<string, unknown>;
}

/**
 * Parsea un instante ISO 8601.
 *
 * Exige la marca de zona: "2026-08-21T15:42:00" sin `Z` ni offset es ambiguo, y
 * resolverlo con el huso del servidor es justo el error que arrastra todo lo demás.
 */
export function parsearInstante(valor: unknown, campo = 'at'): Date {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new ErrorDeEntrada('INVALID_BODY', `${campo} es obligatorio y tiene que ser ISO 8601`);
  }
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(valor.trim())) {
    throw new ErrorDeEntrada(
      'INVALID_BODY',
      `${campo} tiene que incluir zona horaria (por ejemplo 2026-08-21T15:42:00Z)`,
    );
  }
  const instante = new Date(valor);
  if (Number.isNaN(instante.getTime())) {
    throw new ErrorDeEntrada('INVALID_BODY', `${campo} no es una fecha válida: ${valor}`);
  }
  return instante;
}

/** Parsea una fecha civil "YYYY-MM-DD" y verifica que exista en el calendario. */
export function parsearFecha(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new ErrorDeEntrada('INVALID_BODY', `${campo} tiene que tener formato YYYY-MM-DD`);
  }
  const instante = new Date(`${valor}T12:00:00Z`);
  if (Number.isNaN(instante.getTime()) || !instante.toISOString().startsWith(valor)) {
    throw new ErrorDeEntrada('INVALID_BODY', `${campo} no es una fecha real: ${valor}`);
  }
  return valor;
}

/** Devuelve todas las fechas del rango, inclusive. */
export function expandirRango(desde: string, hasta: string): string[] {
  if (hasta < desde) {
    throw new ErrorDeEntrada('INVALID_RANGE', '`to` no puede ser anterior a `from`');
  }

  const fechas: string[] = [];
  const cursor = new Date(`${desde}T12:00:00Z`);
  const fin = new Date(`${hasta}T12:00:00Z`);

  while (cursor <= fin) {
    fechas.push(cursor.toISOString().slice(0, 10));
    if (fechas.length > MAXIMO_DIAS) {
      throw new ErrorDeEntrada('INVALID_RANGE', `El rango no puede superar ${MAXIMO_DIAS} días`);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return fechas;
}

export function parsearMiembros(valor: unknown): MiembroConId[] {
  if (!Array.isArray(valor)) {
    throw new ErrorDeEntrada('INVALID_BODY', '`members` tiene que ser un array');
  }
  if (valor.length > MAXIMO_MIEMBROS) {
    throw new ErrorDeEntrada('INVALID_BODY', `No se admiten más de ${MAXIMO_MIEMBROS} miembros`);
  }
  return valor.map((miembro, indice) => parsearMiembro(miembro, `members[${indice}]`));
}

export function parsearMiembro(valor: unknown, campo: string): MiembroConId {
  const crudo = comoObjeto(valor, campo);

  const id = crudo['id'];
  if (typeof id !== 'string' || id.trim() === '') {
    throw new ErrorDeEntrada('INVALID_MEMBER', `${campo}.id es obligatorio`);
  }

  const timezone = crudo['timezone'];
  if (typeof timezone !== 'string' || !esZonaValida(timezone)) {
    throw new ErrorDeEntrada(
      'INVALID_MEMBER',
      `${campo}.timezone no es un huso IANA conocido: ${String(timezone)}`,
    );
  }

  const paisCrudo = crudo['countryCode'];
  const countryCode =
    typeof paisCrudo === 'string' && /^[A-Za-z]{2}$/.test(paisCrudo.trim())
      ? paisCrudo.trim().toUpperCase()
      : null;

  return {
    id,
    countryCode,
    timezone,
    overrides: parsearOverrides(crudo['overrides'], campo),
  };
}

/**
 * Los overrides son opcionales y cada campo puede venir en `null`, que significa
 * "usar el valor del país". Un valor inválido se rechaza en vez de ignorarse: si el
 * usuario corrigió un horario a mano, silenciarlo le muestra un dato que no pidió.
 */
function parsearOverrides(
  valor: unknown,
  campo: string,
): { workDays: DiaSemana[] | null; workStartLocal: string | null; workEndLocal: string | null } | null {
  if (valor === undefined || valor === null) return null;
  const crudo = comoObjeto(valor, `${campo}.overrides`);

  const diasCrudos = crudo['workDays'];
  let workDays: DiaSemana[] | null = null;
  if (Array.isArray(diasCrudos)) {
    for (const dia of diasCrudos) {
      if (typeof dia !== 'string' || !DIAS_VALIDOS.includes(dia)) {
        throw new ErrorDeEntrada(
          'INVALID_MEMBER',
          `${campo}.overrides.workDays tiene un día inválido: ${String(dia)}`,
        );
      }
    }
    workDays = diasCrudos as DiaSemana[];
  } else if (diasCrudos !== undefined && diasCrudos !== null) {
    throw new ErrorDeEntrada('INVALID_MEMBER', `${campo}.overrides.workDays tiene que ser un array`);
  }

  return {
    workDays,
    workStartLocal: parsearHora(crudo['workStartLocal'], `${campo}.overrides.workStartLocal`),
    workEndLocal: parsearHora(crudo['workEndLocal'], `${campo}.overrides.workEndLocal`),
  };
}

function parsearHora(valor: unknown, campo: string): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) {
    throw new ErrorDeEntrada('INVALID_MEMBER', `${campo} tiene que tener formato HH:MM`);
  }
  return valor;
}
