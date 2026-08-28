/**
 * Genera `src/data/holidays/<PAIS>.json` a partir del proveedor de feriados.
 *
 * Se corre UNA VEZ POR AÑO, a mano, y los JSON resultantes se commitean. En runtime el
 * servidor no hace ninguna llamada de red. Ver PLAN.md sección 5.
 *
 *   npm run build:holidays              # año actual y el siguiente
 *   npm run build:holidays -- 2027 2028 # años explícitos
 *
 * Falla ruidosamente (código de salida 1) si un país objetivo devuelve vacío o da
 * error. Un JSON silenciosamente incompleto es peor que no tener el archivo: sin
 * archivo el backend responde UNKNOWN, que es honesto.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROVEEDOR = 'nager.date';
const BASE = 'https://date.nager.at/api/v3';

/**
 * Países para los que queremos feriados.
 *
 * Incluye todos los de la tabla de semanas laborales (`src/data/workweeks.ts`) más los
 * destinos habituales de equipos distribuidos. Agregar un país acá es gratis; sacarlo
 * hace que el backend responda UNKNOWN para sus miembros.
 */
const PAISES_OBJETIVO: readonly string[] = [
  // Semanas laborales no estándar (el motivo de existir del producto)
  'IL', 'SA', 'QA', 'KW', 'OM', 'BH', 'EG', 'JO', 'IQ', 'PS', 'LY', 'SY', 'YE',
  'BD', 'MV', 'AE', 'AF', 'IR', 'NP', 'BN',
  // Calendario local propio
  'ET', 'TH', 'JP', 'IN',
  // América
  'AR', 'BR', 'CL', 'CO', 'MX', 'PE', 'UY', 'US', 'CA', 'CR', 'EC', 'PY', 'BO', 'VE',
  // Europa
  'ES', 'PT', 'FR', 'DE', 'IT', 'GB', 'IE', 'NL', 'BE', 'PL', 'SE', 'NO', 'DK', 'FI',
  'CH', 'AT', 'CZ', 'RO', 'GR', 'UA',
  // Resto
  'AU', 'NZ', 'ZA', 'NG', 'KE', 'MA', 'TR', 'CN', 'KR', 'SG', 'PH', 'ID', 'VN', 'MY',
  'PK', 'LB', 'RU',
];

/**
 * Países que el proveedor NO cubre, verificados el 2026-08-28 contra
 * `GET /api/v3/AvailableCountries`.
 *
 * No generan archivo y no rompen el script: se informan y sus miembros quedan en
 * UNKNOWN. Está declarado a mano y no leído del proveedor a propósito — si mañana
 * Nager.Date empieza a cubrir uno, el script lo avisa y hay que sacarlo de esta lista.
 *
 * OJO: casi todos son países de semana laboral no estándar. Es la limitación central
 * del proveedor gratuito. Ver la nota al pie de este archivo.
 */
const SIN_COBERTURA_CONOCIDA: readonly string[] = [
  'IL', 'SA', 'QA', 'KW', 'OM', 'JO', 'PS', 'MV', 'AE', 'AF', 'IR', 'NP', 'BN',
  'TH', 'IN', 'MY', 'PK', 'LB',
];

interface FeriadoProveedor {
  readonly date: string;
  readonly name: string;
  readonly localName: string | null;
  readonly types?: readonly string[];
  readonly global?: boolean;
}

interface PaisProveedor {
  readonly countryCode: string;
}

async function main(): Promise<void> {
  const anios = leerAnios();
  const directorio = join(raizDelPaquete(), 'src', 'data', 'holidays');
  mkdirSync(directorio, { recursive: true });

  const disponibles = await paisesDisponibles();
  const fallas: string[] = [];
  const omitidos: string[] = [];
  const recuperados: string[] = [];
  let escritos = 0;

  console.log(`Proveedor: ${PROVEEDOR} — años ${anios.join(', ')}`);
  console.log(`Países objetivo: ${PAISES_OBJETIVO.length}\n`);

  for (const pais of PAISES_OBJETIVO) {
    const cubiertoPorProveedor = disponibles.has(pais);
    const declaradoSinCobertura = SIN_COBERTURA_CONOCIDA.includes(pais);

    if (!cubiertoPorProveedor) {
      if (declaradoSinCobertura) {
        omitidos.push(pais);
      } else {
        fallas.push(`${pais}: el proveedor no lo lista y no está declarado en SIN_COBERTURA_CONOCIDA`);
      }
      continue;
    }

    if (declaradoSinCobertura) {
      recuperados.push(pais);
    }

    try {
      const feriados = await descargarPais(pais, anios);
      if (feriados.length === 0) {
        fallas.push(`${pais}: el proveedor devolvió 0 feriados`);
        continue;
      }
      writeFileSync(
        join(directorio, `${pais}.json`),
        JSON.stringify(
          {
            countryCode: pais,
            provider: PROVEEDOR,
            generatedAt: new Date().toISOString(),
            years: anios,
            holidays: feriados,
          },
          null,
          2,
        ) + '\n',
        'utf8',
      );
      escritos++;
      console.log(`  ${pais}  ${String(feriados.length).padStart(3)} feriados`);
    } catch (error) {
      fallas.push(`${pais}: ${(error as Error).message}`);
    }
  }

  console.log(`\nArchivos escritos: ${escritos}`);

  if (omitidos.length > 0) {
    console.log(
      `\nSin cobertura del proveedor (${omitidos.length}), quedan en UNKNOWN:\n  ${omitidos.join(' ')}`,
    );
  }

  if (recuperados.length > 0) {
    console.log(
      `\nATENCIÓN: el proveedor ahora cubre ${recuperados.join(' ')}.\n` +
        '  Sacarlos de SIN_COBERTURA_CONOCIDA.',
    );
  }

  if (fallas.length > 0) {
    console.error(`\nFALLÓ. ${fallas.length} país(es) sin datos usables:`);
    for (const falla of fallas) console.error(`  - ${falla}`);
    console.error('\nNo se escribió ningún archivo para esos países.');
    process.exit(1);
  }
}

async function paisesDisponibles(): Promise<Set<string>> {
  const respuesta = await fetch(`${BASE}/AvailableCountries`);
  if (!respuesta.ok) {
    throw new Error(`AvailableCountries devolvió ${respuesta.status}`);
  }
  const paises = (await respuesta.json()) as PaisProveedor[];
  return new Set(paises.map((p) => p.countryCode.toUpperCase()));
}

async function descargarPais(
  pais: string,
  anios: readonly number[],
): Promise<{ date: string; name: string; localName: string | null }[]> {
  const acumulado: { date: string; name: string; localName: string | null }[] = [];

  for (const anio of anios) {
    const respuesta = await fetch(`${BASE}/PublicHolidays/${anio}/${pais}`);
    if (!respuesta.ok) {
      throw new Error(`${anio} devolvió ${respuesta.status}`);
    }
    const crudos = (await respuesta.json()) as FeriadoProveedor[];

    for (const crudo of crudos) {
      // Solo feriados nacionales: los regionales no aplican a "el país está de feriado".
      if (crudo.global === false) continue;
      acumulado.push({
        date: crudo.date,
        name: crudo.name,
        localName: crudo.localName ?? null,
      });
    }
  }

  acumulado.sort((a, b) => a.date.localeCompare(b.date));
  return acumulado;
}

function leerAnios(): number[] {
  const argumentos = process.argv.slice(2).filter((a) => /^\d{4}$/.test(a));
  if (argumentos.length > 0) return argumentos.map(Number);
  const actual = new Date().getUTCFullYear();
  return [actual, actual + 1];
}

function raizDelPaquete(): string {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

await main();

/*
 * NOTA SOBRE EL PROVEEDOR (2026-08-28)
 *
 * Nager.Date lista 204 países pero NO cubre ninguno de estos:
 *
 *   IL SA QA KW OM JO PS MV AE AF IR NP BN TH IN MY PK LB
 *
 * Es decir: casi exactamente el conjunto de países con semana laboral no estándar,
 * que es el problema que Almanaq existe para resolver. Israel y Nepal son dos de los
 * cuatro casos de prueba obligatorios de PLAN.md sección 9.
 *
 * Cambiar de proveedor es barato: se toca este archivo y nada más, porque los datos
 * se precalculan. Ver PLAN.md sección 13, decisión abierta "proveedor de feriados".
 */
