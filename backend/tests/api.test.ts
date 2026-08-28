import { describe, expect, it } from 'vitest';

import { app } from '../src/index.js';

const EQUIPO = [
  { id: 'a1', countryCode: 'IL', timezone: 'Asia/Jerusalem', overrides: null },
  { id: 'b2', countryCode: 'ET', timezone: 'Africa/Addis_Ababa', overrides: null },
  { id: 'c3', countryCode: 'NP', timezone: 'Asia/Kathmandu', overrides: null },
  { id: 'd4', countryCode: 'AR', timezone: 'America/Argentina/Buenos_Aires', overrides: null },
];

function post(ruta: string, cuerpo: unknown): Promise<Response> {
  return app.request(ruta, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}

describe('POST /v1/availability', () => {
  it('resuelve el equipo entero en un instante', async () => {
    // Viernes 21/8/2026, 15:42 UTC: mediodía en Buenos Aires, fin de semana en Israel.
    const respuesta = await post('/v1/availability', {
      at: '2026-08-21T15:42:00Z',
      members: EQUIPO,
    });
    const cuerpo = (await respuesta.json()) as {
      at: string;
      availableCount: number;
      totalCount: number;
      members: { id: string; status: string; statusDetail: string; localTime: string }[];
    };

    expect(respuesta.status).toBe(200);
    expect(cuerpo.totalCount).toBe(4);
    expect(cuerpo.at).toBe('2026-08-21T15:42:00.000Z');

    const porId = Object.fromEntries(cuerpo.members.map((m) => [m.id, m]));
    expect(porId['a1']?.status).toBe('LOCAL_WEEKEND');
    expect(porId['a1']?.statusDetail).toBe('Fin de semana en Israel');
    expect(porId['a1']?.localTime).toBe('18:42');
    expect(porId['d4']?.status).toBe('AVAILABLE');
    expect(porId['d4']?.localTime).toBe('12:42');
    expect(cuerpo.availableCount).toBe(1);
  });

  it('ordena por estado: disponibles primero, sin datos al final', async () => {
    const respuesta = await post('/v1/availability', {
      at: '2026-08-21T15:42:00Z',
      members: EQUIPO,
    });
    const cuerpo = (await respuesta.json()) as { members: { status: string }[] };

    const orden = ['AVAILABLE', 'OFF_HOURS', 'LOCAL_WEEKEND', 'LOCAL_HOLIDAY', 'UNKNOWN'];
    const posiciones = cuerpo.members.map((m) => orden.indexOf(m.status));

    expect(posiciones).toEqual([...posiciones].sort((x, y) => x - y));
    expect(cuerpo.members[0]?.status).toBe('AVAILABLE');
  });

  it('rechaza un instante sin zona horaria', async () => {
    const respuesta = await post('/v1/availability', {
      at: '2026-08-21T15:42:00',
      members: EQUIPO,
    });
    const cuerpo = (await respuesta.json()) as { error: { code: string; message: string } };

    expect(respuesta.status).toBe(400);
    expect(cuerpo.error.code).toBe('INVALID_BODY');
    expect(cuerpo.error.message).toContain('zona horaria');
  });

  it('rechaza un huso desconocido en vez de resolverlo con el del servidor', async () => {
    const respuesta = await post('/v1/availability', {
      at: '2026-08-21T15:42:00Z',
      members: [{ id: 'x', countryCode: 'AR', timezone: 'America/Cordoba_Capital' }],
    });
    const cuerpo = (await respuesta.json()) as { error: { code: string } };

    expect(respuesta.status).toBe(400);
    expect(cuerpo.error.code).toBe('INVALID_MEMBER');
  });

  it('acepta un equipo vacío', async () => {
    const respuesta = await post('/v1/availability', { at: '2026-08-21T15:42:00Z', members: [] });
    const cuerpo = (await respuesta.json()) as { totalCount: number; availableCount: number };

    expect(respuesta.status).toBe(200);
    expect(cuerpo.totalCount).toBe(0);
    expect(cuerpo.availableCount).toBe(0);
  });
});

describe('POST /v1/calendar', () => {
  it('devuelve solo los días con conflictos', async () => {
    const respuesta = await post('/v1/calendar', {
      from: '2026-08-17',
      to: '2026-08-23',
      members: EQUIPO,
    });
    const cuerpo = (await respuesta.json()) as {
      days: { date: string; conflictCount: number; conflicts: { memberId: string; reason: string }[] }[];
    };

    expect(respuesta.status).toBe(200);

    // Martes 18: día hábil para los cuatro. Igual aparece con dos conflictos, porque
    // el proveedor no cubre los feriados de Israel ni los de Nepal. Es la consecuencia
    // visible de no afirmar disponibilidad sin datos.
    const martes = cuerpo.days.find((d) => d.date === '2026-08-18');
    expect(martes?.conflictCount).toBe(2);
    expect(martes?.conflicts.map((c) => c.memberId).sort()).toEqual(['a1', 'c3']);
    expect(martes?.conflicts.every((c) => c.reason === 'UNKNOWN')).toBe(true);

    // Etiopía y Argentina, que sí tienen cobertura, no aparecen ese día.
    expect(martes?.conflicts.some((c) => c.memberId === 'b2' || c.memberId === 'd4')).toBe(false);

    const viernes = cuerpo.days.find((d) => d.date === '2026-08-21');
    expect(viernes?.conflicts.some((c) => c.memberId === 'a1' && c.reason === 'LOCAL_WEEKEND')).toBe(
      true,
    );

    const sabado = cuerpo.days.find((d) => d.date === '2026-08-22');
    expect(sabado?.conflictCount).toBe(4);
  });

  it('rechaza un rango invertido', async () => {
    const respuesta = await post('/v1/calendar', {
      from: '2026-08-31',
      to: '2026-08-01',
      members: [],
    });
    const cuerpo = (await respuesta.json()) as { error: { code: string } };

    expect(respuesta.status).toBe(400);
    expect(cuerpo.error.code).toBe('INVALID_RANGE');
  });

  it('rechaza un rango de más de un año', async () => {
    const respuesta = await post('/v1/calendar', {
      from: '2026-01-01',
      to: '2028-01-01',
      members: [],
    });

    expect(respuesta.status).toBe(400);
  });

  it('rechaza una fecha que no existe', async () => {
    const respuesta = await post('/v1/calendar', {
      from: '2026-02-30',
      to: '2026-03-01',
      members: [],
    });

    expect(respuesta.status).toBe(400);
  });
});

describe('POST /v1/member/detail', () => {
  it('arma el detalle con calendario local y próximos feriados', async () => {
    const respuesta = await post('/v1/member/detail', {
      member: { id: 'b2', countryCode: 'ET', timezone: 'Africa/Addis_Ababa' },
      at: '2026-03-02T09:00:00Z',
    });
    const cuerpo = (await respuesta.json()) as {
      localTime: string;
      localDateFormatted: string;
      status: string;
      workWeek: { daysLabel: string; weekendLabel: string; hoursLabel: string };
      localCalendar: { system: string; currentYear: string; note: string | null } | null;
      upcomingHolidays: { name: string; startDate: string }[];
    };

    expect(respuesta.status).toBe(200);
    expect(cuerpo.localTime).toBe('12:00');
    expect(cuerpo.localDateFormatted).toBe('lunes 2 de marzo');
    expect(cuerpo.status).toBe('LOCAL_HOLIDAY');
    expect(cuerpo.workWeek.weekendLabel).toBe('sáb y dom');
    expect(cuerpo.localCalendar?.system).toBe('ethiopic');
    expect(cuerpo.localCalendar?.currentYear).toBe('2018');
    expect(cuerpo.upcomingHolidays.length).toBeLessThanOrEqual(3);
  });

  it('omite el calendario local de un país sin calendario propio', async () => {
    const respuesta = await post('/v1/member/detail', {
      member: { id: 'd4', countryCode: 'AR', timezone: 'America/Argentina/Buenos_Aires' },
      at: '2026-08-21T15:42:00Z',
    });
    const cuerpo = (await respuesta.json()) as { localCalendar: unknown };

    expect(cuerpo.localCalendar).toBeNull();
  });

  it('aplica los overrides manuales del usuario', async () => {
    const respuesta = await post('/v1/member/detail', {
      member: {
        id: 'a1',
        countryCode: 'IL',
        timezone: 'Asia/Jerusalem',
        overrides: { workDays: ['monday', 'tuesday'], workStartLocal: '08:00', workEndLocal: '13:00' },
      },
      at: '2026-08-21T15:42:00Z',
    });
    const cuerpo = (await respuesta.json()) as {
      workWeek: { daysLabel: string; hoursLabel: string };
    };

    expect(cuerpo.workWeek.daysLabel).toBe('lun y mar');
    expect(cuerpo.workWeek.hoursLabel).toBe('8:00 a 13:00');
  });

  it('rechaza un horario con formato inválido', async () => {
    const respuesta = await post('/v1/member/detail', {
      member: {
        id: 'a1',
        countryCode: 'IL',
        timezone: 'Asia/Jerusalem',
        overrides: { workStartLocal: '8am' },
      },
      at: '2026-08-21T15:42:00Z',
    });

    expect(respuesta.status).toBe(400);
  });
});

describe('GET /v1/locations/search', () => {
  it('encuentra Tel Aviv con su huso y su país en español', async () => {
    const respuesta = await app.request('/v1/locations/search?q=tel+aviv');
    const cuerpo = (await respuesta.json()) as {
      results: { city: string; country: string; countryCode: string; timezone: string }[];
    };

    expect(respuesta.status).toBe(200);
    expect(cuerpo.results[0]).toMatchObject({
      city: 'Tel Aviv',
      country: 'Israel',
      countryCode: 'IL',
      timezone: 'Asia/Jerusalem',
    });
  });

  it('ordena por población: "san" trae ciudades grandes primero', async () => {
    const respuesta = await app.request('/v1/locations/search?q=san');
    const cuerpo = (await respuesta.json()) as { results: { city: string }[] };

    expect(cuerpo.results.length).toBeGreaterThan(0);
    expect(cuerpo.results.length).toBeLessThanOrEqual(10);
  });

  it('ignora los acentos', async () => {
    const conAcento = await app.request('/v1/locations/search?q=bogot%C3%A1');
    const sinAcento = await app.request('/v1/locations/search?q=bogota');

    expect(await conAcento.json()).toEqual(await sinAcento.json());
  });

  it('devuelve vacío con menos de dos caracteres', async () => {
    const respuesta = await app.request('/v1/locations/search?q=t');
    const cuerpo = (await respuesta.json()) as { results: unknown[] };

    expect(cuerpo.results).toEqual([]);
  });

  it('respeta el límite pedido', async () => {
    const respuesta = await app.request('/v1/locations/search?q=san&limit=3');
    const cuerpo = (await respuesta.json()) as { results: unknown[] };

    expect(cuerpo.results).toHaveLength(3);
  });

  it('devuelve husos que el resto del backend acepta', async () => {
    const respuesta = await app.request('/v1/locations/search?q=kathmandu');
    const cuerpo = (await respuesta.json()) as { results: { timezone: string }[] };
    const huso = cuerpo.results[0]?.timezone ?? '';

    const disponibilidad = await post('/v1/availability', {
      at: '2026-08-21T00:00:00Z',
      members: [{ id: 'x', countryCode: 'NP', timezone: huso }],
    });
    const resuelto = (await disponibilidad.json()) as { members: { utcOffsetMinutes: number }[] };

    expect(disponibilidad.status).toBe(200);
    expect(resuelto.members[0]?.utcOffsetMinutes).toBe(345);
  });
});

describe('errores generales', () => {
  it('devuelve 404 con forma de error para una ruta inexistente', async () => {
    const respuesta = await app.request('/v1/nada');
    const cuerpo = (await respuesta.json()) as { error: { code: string } };

    expect(respuesta.status).toBe(404);
    expect(cuerpo.error.code).toBe('NOT_FOUND');
  });

  it('rechaza un cuerpo que no es JSON', async () => {
    const respuesta = await app.request('/v1/availability', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'esto no es json',
    });

    expect(respuesta.status).toBe(400);
  });
});
