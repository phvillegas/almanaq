/**
 * Lectura de los feriados precalculados de `src/data/holidays/*.json`.
 *
 * Cero llamadas de red en runtime: los JSON se generan una vez por año con
 * `npm run build:holidays` y se commitean al repositorio. Ver PLAN.md sección 5.
 *
 * La cobertura es por país Y por año. Un país cuyo archivo existe pero no incluye el
 * año consultado NO está cubierto para esa fecha: afirmar "no es feriado" mirando un
 * archivo que no llega hasta ahí sería inventar. Ver PLAN.md sección 10, regla 3.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Feriado {
  /** Fecha gregoriana local, "YYYY-MM-DD". */
  readonly date: string;
  /** Nombre en el idioma del proveedor (inglés en Nager.Date). */
  readonly name: string;
  /** Nombre en el idioma local del país. `null` si el proveedor no lo trae. */
  readonly localName: string | null;
}

export interface ArchivoFeriados {
  readonly countryCode: string;
  readonly provider: string;
  readonly generatedAt: string;
  readonly years: readonly number[];
  readonly holidays: readonly Feriado[];
}

let cache: Map<string, ArchivoFeriados> | null = null;

/**
 * Ubica `src/data/holidays` subiendo hasta la raíz del paquete.
 *
 * Sube en vez de resolver relativo al módulo porque el mismo código corre desde
 * `src/` con tsx y desde `dist/` compilado, y los JSON viven siempre en `src/`:
 * son datos versionados, no artefactos de build.
 */
function directorioDeDatos(): string {
  let actual = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    try {
      readFileSync(join(actual, 'package.json'), 'utf8');
      return join(actual, 'src', 'data', 'holidays');
    } catch {
      actual = dirname(actual);
    }
  }
  throw new Error('No se encontró la raíz del paquete para ubicar src/data/holidays');
}

function cargar(): Map<string, ArchivoFeriados> {
  if (cache) return cache;

  const mapa = new Map<string, ArchivoFeriados>();
  const directorio = directorioDeDatos();

  let archivos: string[];
  try {
    archivos = readdirSync(directorio).filter((f) => f.endsWith('.json'));
  } catch {
    // Sin directorio de datos no hay cobertura de ningún país: todo cae en UNKNOWN.
    archivos = [];
  }

  for (const archivo of archivos) {
    const crudo = JSON.parse(readFileSync(join(directorio, archivo), 'utf8')) as ArchivoFeriados;
    const codigo = crudo.countryCode?.toUpperCase();
    if (!codigo) continue;
    mapa.set(codigo, {
      ...crudo,
      countryCode: codigo,
      holidays: [...crudo.holidays].sort((a, b) => a.date.localeCompare(b.date)),
    });
  }

  cache = mapa;
  return mapa;
}

/** Vacía la cache. Solo para los tests. */
export function reiniciarCache(): void {
  cache = null;
}

export function paisesCubiertos(): string[] {
  return [...cargar().keys()].sort();
}

/**
 * ¿Tenemos feriados de ese país para esa fecha?
 *
 * `fechaISO` es la fecha LOCAL del miembro ("YYYY-MM-DD"), no la del servidor.
 */
export function hayCobertura(countryCode: string | null | undefined, fechaISO: string): boolean {
  const archivo = archivoDe(countryCode);
  if (!archivo) return false;
  const anio = Number(fechaISO.slice(0, 4));
  return archivo.years.includes(anio);
}

/**
 * Feriado que cae en esa fecha local, o `null`.
 *
 * Devolver `null` solo significa "no hay feriado" si `hayCobertura` dio `true`.
 * Sin cobertura, `null` significa "no sabemos".
 *
 * TRAMPA CONOCIDA, no implementada en v1: en los calendarios hebreo e hiyrí el día
 * empieza al atardecer, así que un feriado arranca la tarde anterior a la fecha
 * gregoriana que figura acá. Ver PLAN.md sección 5, trampa 1.
 */
export function feriadoEnFecha(
  countryCode: string | null | undefined,
  fechaISO: string,
): Feriado | null {
  const archivo = archivoDe(countryCode);
  if (!archivo) return null;
  return archivo.holidays.find((f) => f.date === fechaISO) ?? null;
}

/**
 * Próximos feriados a partir de una fecha local, incluida.
 * La pantalla de detalle muestra como máximo 3. Ver PLAN.md sección 7.3.
 */
export function proximosFeriados(
  countryCode: string | null | undefined,
  desdeISO: string,
  limite = 3,
): Feriado[] {
  const archivo = archivoDe(countryCode);
  if (!archivo) return [];
  return archivo.holidays.filter((f) => f.date >= desdeISO).slice(0, limite);
}

function archivoDe(countryCode: string | null | undefined): ArchivoFeriados | null {
  if (typeof countryCode !== 'string') return null;
  return cargar().get(countryCode.trim().toUpperCase()) ?? null;
}
