/**
 * Genera `src/data/locations/cities.json` a partir del volcado de GeoNames.
 *
 * Mismo criterio que los feriados: se precalcula a mano, se commitea y en runtime no
 * hay ninguna llamada de red. Ver PLAN.md sección 5.
 *
 *   npm run build:locations
 *
 * Fuente: https://download.geonames.org/export/dump/
 *   - cities15000.zip        ciudades de más de 15.000 habitantes (~26 mil)
 *   - admin1CodesASCII.txt   nombres de las divisiones administrativas de primer nivel
 *
 * Licencia CC BY 4.0. Verificado el 2026-08-28.
 *
 * El nombre del país NO se guarda: se resuelve en runtime con `Intl.DisplayNames`,
 * que ya lo da en español. Guardar solo el código evita duplicar una tabla que ICU
 * mantiene mejor que nosotros.
 */

import { inflateRawSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://download.geonames.org/export/dump';
const POBLACION_MINIMA = 15_000;

interface Ciudad {
  /** Nombre de la ciudad, en su grafía local. */
  readonly n: string;
  /** Nombre sin acentos ni alfabetos no latinos, para buscar. */
  readonly a: string;
  /** División administrativa de primer nivel. Vacía si GeoNames no la trae. */
  readonly r: string;
  /** Código ISO de país. */
  readonly c: string;
  /** Huso IANA. */
  readonly t: string;
  /** Población, usada para ordenar los resultados. */
  readonly p: number;
}

async function main(): Promise<void> {
  console.log('Descargando admin1CodesASCII.txt...');
  const admin1 = parsearAdmin1(await descargarTexto(`${BASE}/admin1CodesASCII.txt`));
  console.log(`  ${admin1.size} divisiones administrativas`);

  console.log('Descargando cities15000.zip...');
  const zip = Buffer.from(await descargarBinario(`${BASE}/cities15000.zip`));
  const texto = extraerDelZip(zip, 'cities15000.txt');
  console.log(`  ${(zip.length / 1024 / 1024).toFixed(1)} MB comprimidos`);

  const ciudades = parsearCiudades(texto, admin1);
  if (ciudades.length === 0) {
    console.error('FALLÓ: el volcado no produjo ninguna ciudad.');
    process.exit(1);
  }

  const sinHuso = ciudades.filter((c) => c.t === '').length;
  if (sinHuso > 0) {
    console.error(`FALLÓ: ${sinHuso} ciudades sin huso horario. El volcado está incompleto.`);
    process.exit(1);
  }

  const directorio = join(raizDelPaquete(), 'src', 'data', 'locations');
  mkdirSync(directorio, { recursive: true });

  // Una ciudad por línea: el archivo se commitea y así los diffs anuales son legibles.
  const cuerpo = ciudades.map((c) => JSON.stringify(c)).join(',\n');
  const contenido =
    '{\n' +
    `"source": "geonames cities15000",\n` +
    `"license": "CC BY 4.0",\n` +
    `"generatedAt": ${JSON.stringify(new Date().toISOString())},\n` +
    `"count": ${ciudades.length},\n` +
    '"cities": [\n' +
    cuerpo +
    '\n]\n}\n';

  const destino = join(directorio, 'cities.json');
  writeFileSync(destino, contenido, 'utf8');

  console.log(`\n${ciudades.length} ciudades escritas en src/data/locations/cities.json`);
  console.log(`Tamaño: ${(contenido.length / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Países distintos: ${new Set(ciudades.map((c) => c.c)).size}`);
}

/** `IL.05` → `Tel Aviv`. */
function parsearAdmin1(texto: string): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const linea of texto.split('\n')) {
    const campos = linea.split('\t');
    if (campos.length < 2) continue;
    mapa.set(campos[0]!, campos[1]!);
  }
  return mapa;
}

function parsearCiudades(texto: string, admin1: Map<string, string>): Ciudad[] {
  const ciudades: Ciudad[] = [];

  for (const linea of texto.split('\n')) {
    if (linea.trim() === '') continue;
    const campos = linea.split('\t');
    // Columnas del volcado: 1 name, 2 asciiname, 8 country code, 10 admin1 code,
    // 14 population, 17 timezone. Documentado en el readme.txt de GeoNames.
    if (campos.length < 18) continue;

    const poblacion = Number(campos[14]) || 0;
    if (poblacion < POBLACION_MINIMA) continue;

    const pais = campos[8]!;
    const codigoAdmin1 = campos[10]!;

    ciudades.push({
      n: campos[1]!,
      a: campos[2]!,
      r: admin1.get(`${pais}.${codigoAdmin1}`) ?? '',
      c: pais,
      t: campos[17]!.trim(),
      p: poblacion,
    });
  }

  // Por población descendente: el orden del archivo es el orden de los resultados.
  ciudades.sort((x, y) => y.p - x.p || x.a.localeCompare(y.a));
  return ciudades;
}

/**
 * Extrae un archivo del zip leyendo el directorio central.
 *
 * Se hace a mano en vez de agregar una librería: es un script anual que abre un zip
 * de un solo archivo, y CLAUDE.md regla 5 pide no sumar dependencias sin preguntar.
 */
function extraerDelZip(zip: Buffer, nombre: string): string {
  const FIN_DIRECTORIO = 0x06054b50;
  const ENTRADA_DIRECTORIO = 0x02014b50;

  let fin = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === FIN_DIRECTORIO) {
      fin = i;
      break;
    }
  }
  if (fin === -1) throw new Error('Zip inválido: no se encontró el directorio central');

  const cantidad = zip.readUInt16LE(fin + 10);
  let cursor = zip.readUInt32LE(fin + 16);

  for (let i = 0; i < cantidad; i++) {
    if (zip.readUInt32LE(cursor) !== ENTRADA_DIRECTORIO) {
      throw new Error('Zip inválido: entrada de directorio corrupta');
    }
    const metodo = zip.readUInt16LE(cursor + 10);
    const tamanioComprimido = zip.readUInt32LE(cursor + 20);
    const largoNombre = zip.readUInt16LE(cursor + 28);
    const largoExtra = zip.readUInt16LE(cursor + 30);
    const largoComentario = zip.readUInt16LE(cursor + 32);
    const offsetLocal = zip.readUInt32LE(cursor + 42);
    const nombreEntrada = zip.subarray(cursor + 46, cursor + 46 + largoNombre).toString('utf8');

    if (nombreEntrada === nombre) {
      const largoNombreLocal = zip.readUInt16LE(offsetLocal + 26);
      const largoExtraLocal = zip.readUInt16LE(offsetLocal + 28);
      const inicio = offsetLocal + 30 + largoNombreLocal + largoExtraLocal;
      const datos = zip.subarray(inicio, inicio + tamanioComprimido);
      if (metodo === 0) return datos.toString('utf8');
      if (metodo === 8) return inflateRawSync(datos).toString('utf8');
      throw new Error(`Método de compresión no soportado: ${metodo}`);
    }

    cursor += 46 + largoNombre + largoExtra + largoComentario;
  }

  throw new Error(`El zip no contiene ${nombre}`);
}

async function descargarTexto(url: string): Promise<string> {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`${url} devolvió ${respuesta.status}`);
  return respuesta.text();
}

async function descargarBinario(url: string): Promise<ArrayBuffer> {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`${url} devolvió ${respuesta.status}`);
  return respuesta.arrayBuffer();
}

function raizDelPaquete(): string {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

await main();
