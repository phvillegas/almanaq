/**
 * Generates `src/data/locations/cities.json` from the GeoNames dump.
 *
 * Same approach as the holidays: precomputed by hand, committed, and no network calls
 * at runtime. See PLAN.md section 5.
 *
 *   npm run build:locations
 *
 * Source: https://download.geonames.org/export/dump/
 *   - cities15000.zip        cities above 15,000 inhabitants (~34k rows)
 *   - admin1CodesASCII.txt   names of first-level administrative divisions
 *
 * Licensed CC BY 4.0. Checked on 2026-08-28.
 *
 * The country name is NOT stored: it is resolved at runtime with `Intl.DisplayNames`
 * in the caller's locale. Storing only the code avoids duplicating a table ICU keeps
 * better than we would, and keeps the file locale-independent.
 */

import { inflateRawSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://download.geonames.org/export/dump';
const MINIMUM_POPULATION = 15_000;

interface City {
  /** City name, in its local spelling. */
  readonly n: string;
  /** Name without accents or non-Latin scripts, used for searching. */
  readonly a: string;
  /** First-level administrative division. Empty when GeoNames has none. */
  readonly r: string;
  /** ISO country code. */
  readonly c: string;
  /** IANA time zone. */
  readonly t: string;
  /** Population, used to rank results. */
  readonly p: number;
}

async function main(): Promise<void> {
  console.log('Downloading admin1CodesASCII.txt...');
  const admin1 = parseAdmin1(await downloadText(`${BASE}/admin1CodesASCII.txt`));
  console.log(`  ${admin1.size} administrative divisions`);

  console.log('Downloading cities15000.zip...');
  const zip = Buffer.from(await downloadBinary(`${BASE}/cities15000.zip`));
  const text = extractFromZip(zip, 'cities15000.txt');
  console.log(`  ${(zip.length / 1024 / 1024).toFixed(1)} MB compressed`);

  const cities = parseCities(text, admin1);
  if (cities.length === 0) {
    console.error('FAILED: the dump produced no cities.');
    process.exit(1);
  }

  const withoutZone = cities.filter((city) => city.t === '').length;
  if (withoutZone > 0) {
    console.error(`FAILED: ${withoutZone} cities without a time zone. The dump is incomplete.`);
    process.exit(1);
  }

  const directory = join(packageRoot(), 'src', 'data', 'locations');
  mkdirSync(directory, { recursive: true });

  // One city per line: the file is committed, so yearly diffs stay readable.
  const body = cities.map((city) => JSON.stringify(city)).join(',\n');
  const contents =
    '{\n' +
    '"source": "geonames cities15000",\n' +
    '"license": "CC BY 4.0",\n' +
    `"generatedAt": ${JSON.stringify(new Date().toISOString())},\n` +
    `"count": ${cities.length},\n` +
    '"cities": [\n' +
    body +
    '\n]\n}\n';

  writeFileSync(join(directory, 'cities.json'), contents, 'utf8');

  console.log(`\n${cities.length} cities written to src/data/locations/cities.json`);
  console.log(`Size: ${(contents.length / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Distinct countries: ${new Set(cities.map((city) => city.c)).size}`);
}

/** `IL.05` -> `Tel Aviv`. */
function parseAdmin1(text: string): Map<string, string> {
  const byCode = new Map<string, string>();
  for (const line of text.split('\n')) {
    const fields = line.split('\t');
    if (fields.length < 2) continue;
    byCode.set(fields[0]!, fields[1]!);
  }
  return byCode;
}

function parseCities(text: string, admin1: Map<string, string>): City[] {
  const cities: City[] = [];

  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const fields = line.split('\t');
    // Dump columns: 1 name, 2 asciiname, 8 country code, 10 admin1 code,
    // 14 population, 17 timezone. Documented in the GeoNames readme.txt.
    if (fields.length < 18) continue;

    const population = Number(fields[14]) || 0;
    if (population < MINIMUM_POPULATION) continue;

    const country = fields[8]!;
    const admin1Code = fields[10]!;

    cities.push({
      n: fields[1]!,
      a: fields[2]!,
      r: admin1.get(`${country}.${admin1Code}`) ?? '',
      c: country,
      t: fields[17]!.trim(),
      p: population,
    });
  }

  // Descending by population: the file order is the result order.
  cities.sort((left, right) => right.p - left.p || left.a.localeCompare(right.a));
  return cities;
}

/**
 * Extracts one file from the zip by reading the central directory.
 *
 * Done by hand instead of pulling in a library: this is a yearly script opening a zip
 * with a single entry, and CLAUDE.md rule 5 asks not to add dependencies unprompted.
 */
function extractFromZip(zip: Buffer, name: string): string {
  const END_OF_DIRECTORY = 0x06054b50;
  const DIRECTORY_ENTRY = 0x02014b50;

  let end = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) !== END_OF_DIRECTORY) continue;
    end = i;
    break;
  }
  if (end === -1) throw new Error('Invalid zip: central directory not found');

  const entries = zip.readUInt16LE(end + 10);
  let cursor = zip.readUInt32LE(end + 16);

  for (let i = 0; i < entries; i++) {
    if (zip.readUInt32LE(cursor) !== DIRECTORY_ENTRY) {
      throw new Error('Invalid zip: corrupt directory entry');
    }
    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const entryName = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');

    if (entryName === name) {
      return decompress(zip, localOffset, method, compressedSize);
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`The zip does not contain ${name}`);
}

function decompress(zip: Buffer, localOffset: number, method: number, size: number): string {
  const nameLength = zip.readUInt16LE(localOffset + 26);
  const extraLength = zip.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + nameLength + extraLength;
  const data = zip.subarray(start, start + size);

  if (method === 0) return data.toString('utf8');
  if (method === 8) return inflateRawSync(data).toString('utf8');
  throw new Error(`Unsupported compression method: ${method}`);
}

async function downloadText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function downloadBinary(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.arrayBuffer();
}

function packageRoot(): string {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

await main();
