import { describe, expect, it } from 'vitest';

import {
  anioLocal,
  fechaLargaLocal,
  obtenerCalendarioLocal,
  offsetEnMinutos,
  partesLocales,
} from '../src/domain/calendars.js';

describe('partesLocales', () => {
  it('convierte un instante UTC a la hora local del miembro', () => {
    const partes = partesLocales(new Date('2026-08-21T15:42:00Z'), 'Asia/Jerusalem');

    expect(partes.localTime).toBe('18:42');
    expect(partes.localDate).toBe('2026-08-21');
    expect(partes.localWeekday).toBe('friday');
    expect(partes.utcOffsetMinutes).toBe(180);
  });

  it('resuelve offsets que no son horas enteras', () => {
    // Nepal está en UTC+5:45. Es el caso que rompe cualquier implementación que
    // guarde offsets en horas. PLAN.md sección 9.
    const partes = partesLocales(new Date('2026-08-21T00:00:00Z'), 'Asia/Kathmandu');

    expect(partes.utcOffsetMinutes).toBe(345);
    expect(partes.localTime).toBe('05:45');
  });

  it('sigue el horario de verano en vez de usar un offset fijo', () => {
    const invierno = offsetEnMinutos(new Date('2026-01-15T12:00:00Z'), 'Europe/Madrid');
    const verano = offsetEnMinutos(new Date('2026-07-15T12:00:00Z'), 'Europe/Madrid');

    expect(invierno).toBe(60);
    expect(verano).toBe(120);
  });

  it('devuelve medianoche como 00:00 y no como 24:00', () => {
    const partes = partesLocales(new Date('2026-08-21T00:00:00Z'), 'UTC');

    expect(partes.localTime).toBe('00:00');
    expect(partes.localDate).toBe('2026-08-21');
  });

  it('rechaza husos desconocidos en vez de caer en un default', () => {
    expect(() => partesLocales(new Date(), 'Marte/Olympus')).toThrow(RangeError);
  });

  it('la fecha local depende del huso pedido, no del huso del proceso', () => {
    // Es la trampa del snippet de SETUP.md sección 2: `new Date('2026-08-17')` es
    // medianoche UTC, así que en cualquier huso negativo todavía es el día anterior.
    const medianocheUTC = new Date('2026-08-17');

    expect(partesLocales(medianocheUTC, 'UTC').localDate).toBe('2026-08-17');
    expect(partesLocales(medianocheUTC, 'America/Argentina/Buenos_Aires').localDate).toBe(
      '2026-08-16',
    );
  });
});

describe('fechaLargaLocal', () => {
  it('redacta la fecha sin año ni coma, como pide el contrato', () => {
    expect(fechaLargaLocal(new Date('2026-08-21T15:42:00Z'), 'Asia/Jerusalem')).toBe(
      'viernes 21 de agosto',
    );
  });
});

describe('obtenerCalendarioLocal', () => {
  it('resuelve el calendario etíope con su año local', () => {
    const calendario = obtenerCalendarioLocal(
      'ET',
      new Date('2026-08-21T15:42:00Z'),
      'Africa/Addis_Ababa',
    );

    expect(calendario?.system).toBe('ethiopic');
    expect(calendario?.label).toBe('Etíope');
    expect(calendario?.currentYear).toBe('2018');
    expect(calendario?.note).not.toBeNull();
  });

  it('resuelve el calendario hebreo y avisa que el día empieza al atardecer', () => {
    const calendario = obtenerCalendarioLocal(
      'IL',
      new Date('2026-08-21T15:42:00Z'),
      'Asia/Jerusalem',
    );

    expect(calendario?.system).toBe('hebrew');
    expect(calendario?.currentYear).toBe('5786');
    expect(calendario?.note).toContain('atardecer');
  });

  it('incluye la era en el calendario japonés', () => {
    expect(anioLocal(new Date('2026-08-21T15:42:00Z'), 'Asia/Tokyo', 'japanese')).toBe(
      'Reiwa 8',
    );
  });

  it('devuelve null para países sin calendario propio', () => {
    expect(
      obtenerCalendarioLocal('AR', new Date(), 'America/Argentina/Buenos_Aires'),
    ).toBeNull();
  });

  it('devuelve null para Nepal en vez de aproximar el bikram sambat', () => {
    // ICU no trae bikram sambat. Mostrar otro calendario sería inventar un dato.
    // PLAN.md sección 5.
    expect(obtenerCalendarioLocal('NP', new Date(), 'Asia/Kathmandu')).toBeNull();
  });
});
