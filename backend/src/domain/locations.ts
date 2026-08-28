/**
 * Búsqueda de ciudades sobre el volcado precalculado de GeoNames.
 *
 * El archivo lo genera `npm run build:locations` y está commiteado. En runtime no hay
 * ninguna llamada de red, igual que con los feriados. Ver PLAN.md sección 5.
 *
 * NOTA DE ESTRUCTURA: este archivo no está en la lista de SETUP.md sección 2. Lo puse
 * en `domain/` por simetría con `holidays.ts`, que también lee un JSON de `data/` y lo
 * consulta. Si preferís otra ubicación, se mueve.
 *
 * LIMITACIÓN CONOCIDA: se busca por el nombre local y por su transliteración ASCII,
 * no por exónimos. "Londres" no encuentra London y "Ginebra" no encuentra Genève.
 * Traerlos exigiría el volcado de nombres alternativos de GeoNames, que pesa dos
 * órdenes de magnitud más que este.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Ciudad tal como está en el JSON. Claves cortas: el archivo pesa 3 MB. */
interface CiudadCruda {
  readonly n: string;
  readonly a: string;
  readonly r: string;
  readonly c: string;
  readonly t: string;
  readonly p: number;
}

interface CiudadIndexada extends CiudadCruda {
  /** Nombre normalizado para comparar: sin acentos, en minúsculas. */
  readonly busqueda: string;
}

/** Forma que devuelve `GET /v1/locations/search`. Ver PLAN.md sección 4. */
export interface Ubicacion {
  readonly city: string;
  readonly region: string;
  readonly country: string;
  readonly countryCode: string;
  readonly timezone: string;
}

const LIMITE_POR_DEFECTO = 10;
const LIMITE_MAXIMO = 25;

const NOMBRES_PAIS = new Intl.DisplayNames(['es'], { type: 'region' });

let indice: CiudadIndexada[] | null = null;

/**
 * Busca ciudades por prefijo.
 *
 * Ordena los que empiezan con lo tipeado antes que los que solo lo contienen, y dentro
 * de cada grupo por población. Con "san" tiene que salir primero San Pablo y no un
 * pueblo homónimo de 15 mil habitantes.
 *
 * Una consulta de menos de dos caracteres devuelve vacío: con una letra el resultado
 * es ruido y recorrer 34 mil ciudades no aporta nada.
 */
export function buscarCiudades(consulta: string, limite = LIMITE_POR_DEFECTO): Ubicacion[] {
  const termino = normalizar(consulta);
  if (termino.length < 2) return [];

  const tope = Math.min(Math.max(1, Math.trunc(limite) || LIMITE_POR_DEFECTO), LIMITE_MAXIMO);
  const porPrefijo: CiudadIndexada[] = [];
  const porContenido: CiudadIndexada[] = [];

  for (const ciudad of cargar()) {
    if (ciudad.busqueda.startsWith(termino)) {
      porPrefijo.push(ciudad);
      // El índice está ordenado por población, así que con `tope` coincidencias por
      // prefijo ya no puede aparecer nada mejor más abajo.
      if (porPrefijo.length >= tope) break;
    } else if (porContenido.length < tope && ciudad.busqueda.includes(termino)) {
      porContenido.push(ciudad);
    }
  }

  // El índice ya viene ordenado por población, así que alcanza con concatenar.
  return [...porPrefijo, ...porContenido].slice(0, tope).map(aUbicacion);
}

/** Vacía la cache. Solo para los tests. */
export function reiniciarCache(): void {
  indice = null;
}

export function cantidadDeCiudades(): number {
  return cargar().length;
}

function aUbicacion(ciudad: CiudadIndexada): Ubicacion {
  return {
    city: ciudad.n,
    region: ciudad.r,
    country: nombreDePais(ciudad.c),
    countryCode: ciudad.c,
    timezone: ciudad.t,
  };
}

/**
 * Quita acentos y pasa a minúsculas.
 *
 * NFD separa la letra de su tilde y el rango ̀-ͯ borra las tildes sueltas,
 * así "Bogotá" y "bogota" comparan igual. No toca alfabetos no latinos: para esos
 * está el `asciiname` de GeoNames, que ya viene transliterado.
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function cargar(): CiudadIndexada[] {
  if (indice) return indice;

  const ruta = join(raizDelPaquete(), 'src', 'data', 'locations', 'cities.json');
  let crudo: { cities: CiudadCruda[] };
  try {
    crudo = JSON.parse(readFileSync(ruta, 'utf8')) as { cities: CiudadCruda[] };
  } catch {
    // Sin volcado no hay autocompletado, pero el resto del backend sigue funcionando.
    indice = [];
    return indice;
  }

  indice = crudo.cities.map((ciudad) => ({
    ...ciudad,
    // Se indexa el nombre ASCII: es el que permite tipear "Zurich" y encontrar Zürich.
    busqueda: normalizar(ciudad.a || ciudad.n),
  }));
  return indice;
}

function nombreDePais(countryCode: string): string {
  try {
    return NOMBRES_PAIS.of(countryCode) ?? countryCode;
  } catch {
    return countryCode;
  }
}

function raizDelPaquete(): string {
  let actual = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    try {
      readFileSync(join(actual, 'package.json'), 'utf8');
      return actual;
    } catch {
      actual = dirname(actual);
    }
  }
  throw new Error('No se encontró la raíz del paquete');
}
