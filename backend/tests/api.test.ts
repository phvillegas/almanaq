import { describe, expect, it } from 'vitest';

import { app } from '../src/index.js';

const TEAM = [
  { id: 'a1', countryCode: 'IL', timezone: 'Asia/Jerusalem', overrides: null },
  { id: 'b2', countryCode: 'ET', timezone: 'Africa/Addis_Ababa', overrides: null },
  { id: 'c3', countryCode: 'NP', timezone: 'Asia/Kathmandu', overrides: null },
  { id: 'd4', countryCode: 'AR', timezone: 'America/Argentina/Buenos_Aires', overrides: null },
];

function post(route: string, body: unknown, language = 'en'): Promise<Response> {
  return app.request(route, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept-language': language },
    body: JSON.stringify(body),
  });
}

function get(route: string, language = 'en'): Promise<Response> {
  return app.request(route, { headers: { 'accept-language': language } });
}

describe('POST /v1/availability', () => {
  it('resolves the whole team at one instant', async () => {
    // Friday 21 Aug 2026, 15:42 UTC: noon in Buenos Aires, weekend in Israel.
    const response = await post('/v1/availability', {
      at: '2026-08-21T15:42:00Z',
      members: TEAM,
    });
    const body = (await response.json()) as {
      at: string;
      availableCount: number;
      totalCount: number;
      members: { id: string; status: string; statusDetail: string; localTime: string }[];
    };

    expect(response.status).toBe(200);
    expect(body.totalCount).toBe(4);
    expect(body.at).toBe('2026-08-21T15:42:00.000Z');

    const byId = Object.fromEntries(body.members.map((member) => [member.id, member]));
    expect(byId['a1']?.status).toBe('LOCAL_WEEKEND');
    expect(byId['a1']?.statusDetail).toBe('Weekend in Israel');
    expect(byId['a1']?.localTime).toBe('18:42');
    expect(byId['d4']?.status).toBe('AVAILABLE');
    expect(byId['d4']?.localTime).toBe('12:42');
    expect(body.availableCount).toBe(1);
  });

  it('sorts by status: available first, no data last', async () => {
    const response = await post('/v1/availability', {
      at: '2026-08-21T15:42:00Z',
      members: TEAM,
    });
    const body = (await response.json()) as { members: { status: string }[] };

    const order = ['AVAILABLE', 'OFF_HOURS', 'LOCAL_WEEKEND', 'LOCAL_HOLIDAY', 'UNKNOWN'];
    const positions = body.members.map((member) => order.indexOf(member.status));

    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(body.members[0]?.status).toBe('AVAILABLE');
  });

  it('rejects an instant without a time zone', async () => {
    const response = await post('/v1/availability', {
      at: '2026-08-21T15:42:00',
      members: TEAM,
    });
    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_BODY');
    expect(body.error.message).toContain('time zone');
  });

  it('rejects an unknown time zone instead of resolving it with the server one', async () => {
    const response = await post('/v1/availability', {
      at: '2026-08-21T15:42:00Z',
      members: [{ id: 'x', countryCode: 'AR', timezone: 'America/Cordoba_Capital' }],
    });
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_MEMBER');
  });

  it('accepts an empty team', async () => {
    const response = await post('/v1/availability', { at: '2026-08-21T15:42:00Z', members: [] });
    const body = (await response.json()) as { totalCount: number; availableCount: number };

    expect(response.status).toBe(200);
    expect(body.totalCount).toBe(0);
    expect(body.availableCount).toBe(0);
  });
});

describe('content negotiation', () => {
  it('writes the status text in the language the client asks for', async () => {
    const payload = { at: '2026-08-21T15:42:00Z', members: [TEAM[0]] };

    const english = (await (await post('/v1/availability', payload, 'en-US')).json()) as {
      members: { statusLabel: string; statusDetail: string }[];
    };
    const spanish = (await (await post('/v1/availability', payload, 'es-AR')).json()) as {
      members: { statusLabel: string; statusDetail: string }[];
    };

    expect(english.members[0]?.statusLabel).toBe('Weekend');
    expect(english.members[0]?.statusDetail).toBe('Weekend in Israel');
    expect(spanish.members[0]?.statusLabel).toBe('Fin de semana');
    expect(spanish.members[0]?.statusDetail).toBe('Fin de semana en Israel');
  });

  it('falls back to Spanish when no language is requested', async () => {
    const response = await app.request('/v1/availability', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ at: '2026-08-21T15:42:00Z', members: [TEAM[0]] }),
    });
    const body = (await response.json()) as { members: { statusLabel: string }[] };

    expect(body.members[0]?.statusLabel).toBe('Fin de semana');
  });

  it('keeps the machine readable fields identical across locales', async () => {
    const payload = { at: '2026-08-21T15:42:00Z', members: [TEAM[0]] };

    const english = (await (await post('/v1/availability', payload, 'en')).json()) as {
      members: { status: string; localTime: string; utcOffsetMinutes: number }[];
    };
    const spanish = (await (await post('/v1/availability', payload, 'es')).json()) as {
      members: { status: string; localTime: string; utcOffsetMinutes: number }[];
    };

    expect(english.members[0]?.status).toBe(spanish.members[0]?.status);
    expect(english.members[0]?.localTime).toBe(spanish.members[0]?.localTime);
    expect(english.members[0]?.utcOffsetMinutes).toBe(spanish.members[0]?.utcOffsetMinutes);
  });
});

describe('POST /v1/calendar', () => {
  it('returns only the days that have conflicts', async () => {
    const response = await post('/v1/calendar', {
      from: '2026-08-17',
      to: '2026-08-23',
      members: TEAM,
    });
    const body = (await response.json()) as {
      days: {
        date: string;
        conflictCount: number;
        conflicts: { memberId: string; reason: string }[];
      }[];
    };

    expect(response.status).toBe(200);

    // Tuesday the 18th is a working day for all four. It still shows two conflicts,
    // because the provider covers neither Israeli nor Nepali holidays. That is the
    // visible cost of never claiming availability without data.
    const tuesday = body.days.find((day) => day.date === '2026-08-18');
    expect(tuesday?.conflictCount).toBe(2);
    expect(tuesday?.conflicts.map((conflict) => conflict.memberId).sort()).toEqual(['a1', 'c3']);
    expect(tuesday?.conflicts.every((conflict) => conflict.reason === 'UNKNOWN')).toBe(true);

    const friday = body.days.find((day) => day.date === '2026-08-21');
    expect(
      friday?.conflicts.some(
        (conflict) => conflict.memberId === 'a1' && conflict.reason === 'LOCAL_WEEKEND',
      ),
    ).toBe(true);

    const saturday = body.days.find((day) => day.date === '2026-08-22');
    expect(saturday?.conflictCount).toBe(4);
  });

  it('rejects an inverted range', async () => {
    const response = await post('/v1/calendar', {
      from: '2026-08-31',
      to: '2026-08-01',
      members: [],
    });
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('INVALID_RANGE');
  });

  it('rejects a range longer than a year', async () => {
    const response = await post('/v1/calendar', {
      from: '2026-01-01',
      to: '2028-01-01',
      members: [],
    });

    expect(response.status).toBe(400);
  });

  it('rejects a date that does not exist', async () => {
    const response = await post('/v1/calendar', {
      from: '2026-02-30',
      to: '2026-03-01',
      members: [],
    });

    expect(response.status).toBe(400);
  });
});

describe('POST /v1/member/detail', () => {
  it('builds the detail with the local calendar and upcoming holidays', async () => {
    const response = await post('/v1/member/detail', {
      member: { id: 'b2', countryCode: 'ET', timezone: 'Africa/Addis_Ababa' },
      at: '2026-03-02T09:00:00Z',
    });
    const body = (await response.json()) as {
      localTime: string;
      localDateFormatted: string;
      status: string;
      workWeek: { daysLabel: string; weekendLabel: string; hoursLabel: string };
      localCalendar: { system: string; currentYear: string; note: string | null } | null;
      upcomingHolidays: { name: string; startDate: string }[];
    };

    expect(response.status).toBe(200);
    expect(body.localTime).toBe('12:00');
    expect(body.localDateFormatted).toBe('Monday, March 2');
    expect(body.status).toBe('LOCAL_HOLIDAY');
    expect(body.workWeek.weekendLabel).toBe('Sat and Sun');
    expect(body.localCalendar?.system).toBe('ethiopic');
    expect(body.localCalendar?.currentYear).toBe('2018');
    expect(body.upcomingHolidays.length).toBeLessThanOrEqual(3);
  });

  it('omits the local calendar for a country without one', async () => {
    const response = await post('/v1/member/detail', {
      member: { id: 'd4', countryCode: 'AR', timezone: 'America/Argentina/Buenos_Aires' },
      at: '2026-08-21T15:42:00Z',
    });
    const body = (await response.json()) as { localCalendar: unknown };

    expect(body.localCalendar).toBeNull();
  });

  it('applies the manual overrides set by the user', async () => {
    const response = await post('/v1/member/detail', {
      member: {
        id: 'a1',
        countryCode: 'IL',
        timezone: 'Asia/Jerusalem',
        overrides: {
          workDays: ['monday', 'tuesday'],
          workStartLocal: '08:00',
          workEndLocal: '13:00',
        },
      },
      at: '2026-08-21T15:42:00Z',
    });
    const body = (await response.json()) as {
      workWeek: { daysLabel: string; hoursLabel: string };
    };

    expect(body.workWeek.daysLabel).toBe('Mon and Tue');
    expect(body.workWeek.hoursLabel).toBe('8:00 to 13:00');
  });

  it('rejects a badly formatted time', async () => {
    const response = await post('/v1/member/detail', {
      member: {
        id: 'a1',
        countryCode: 'IL',
        timezone: 'Asia/Jerusalem',
        overrides: { workStartLocal: '8am' },
      },
      at: '2026-08-21T15:42:00Z',
    });

    expect(response.status).toBe(400);
  });
});

describe('GET /v1/locations/search', () => {
  it('finds Tel Aviv with its time zone and its country name', async () => {
    const response = await get('/v1/locations/search?q=tel+aviv');
    const body = (await response.json()) as {
      results: { city: string; country: string; countryCode: string; timezone: string }[];
    };

    expect(response.status).toBe(200);
    expect(body.results[0]).toMatchObject({
      city: 'Tel Aviv',
      country: 'Israel',
      countryCode: 'IL',
      timezone: 'Asia/Jerusalem',
    });
  });

  it('localizes the country name but not the city name', async () => {
    const english = (await (await get('/v1/locations/search?q=addis', 'en')).json()) as {
      results: { city: string; country: string }[];
    };
    const spanish = (await (await get('/v1/locations/search?q=addis', 'es')).json()) as {
      results: { city: string; country: string }[];
    };

    expect(english.results[0]?.country).toBe('Ethiopia');
    expect(spanish.results[0]?.country).toBe('Etiopía');
    // The city keeps its local spelling in both.
    expect(english.results[0]?.city).toBe(spanish.results[0]?.city);
  });

  it('ranks by population', async () => {
    const response = await get('/v1/locations/search?q=san');
    const body = (await response.json()) as { results: { city: string }[] };

    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results.length).toBeLessThanOrEqual(10);
  });

  it('ignores accents', async () => {
    const accented = await get('/v1/locations/search?q=bogot%C3%A1');
    const plain = await get('/v1/locations/search?q=bogota');

    expect(await accented.json()).toEqual(await plain.json());
  });

  it('returns nothing for fewer than two characters', async () => {
    const response = await get('/v1/locations/search?q=t');
    const body = (await response.json()) as { results: unknown[] };

    expect(body.results).toEqual([]);
  });

  it('honours the requested limit', async () => {
    const response = await get('/v1/locations/search?q=san&limit=3');
    const body = (await response.json()) as { results: unknown[] };

    expect(body.results).toHaveLength(3);
  });

  it('returns time zones the rest of the backend accepts', async () => {
    const response = await get('/v1/locations/search?q=kathmandu');
    const body = (await response.json()) as { results: { timezone: string }[] };
    const timezone = body.results[0]?.timezone ?? '';

    const availability = await post('/v1/availability', {
      at: '2026-08-21T00:00:00Z',
      members: [{ id: 'x', countryCode: 'NP', timezone }],
    });
    const resolved = (await availability.json()) as { members: { utcOffsetMinutes: number }[] };

    expect(availability.status).toBe(200);
    expect(resolved.members[0]?.utcOffsetMinutes).toBe(345);
  });
});

describe('general errors', () => {
  it('returns a 404 shaped like an error for an unknown route', async () => {
    const response = await get('/v1/nothing');
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('rejects a body that is not JSON', async () => {
    const response = await app.request('/v1/availability', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'this is not json',
    });

    expect(response.status).toBe(400);
  });
});
