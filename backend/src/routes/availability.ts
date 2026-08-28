/**
 * `POST /v1/availability` — el endpoint principal.
 *
 * El cliente manda su equipo y un instante; recibe estados ya resueltos. Ver PLAN.md
 * sección 4.
 */

import { Hono } from 'hono';

import { resolverEstado, type Estado } from '../domain/status.js';
import { comoObjeto, parsearInstante, parsearMiembros } from './entrada.js';

/**
 * Orden en que se devuelve la lista: disponibles primero, después fuera de horario,
 * después fin de semana y feriado, y al final los que no sabemos. PLAN.md sección 7.1.
 *
 * El backend ordena por estado y el cliente ordena por nombre dentro de cada grupo:
 * el backend no recibe los nombres y el cliente no tiene por qué saber qué estado
 * importa más. Cada uno ordena por lo que efectivamente conoce.
 */
const PRIORIDAD: Readonly<Record<Estado, number>> = {
  AVAILABLE: 0,
  OFF_HOURS: 1,
  LOCAL_WEEKEND: 2,
  LOCAL_HOLIDAY: 3,
  UNKNOWN: 4,
};

export const availability = new Hono();

availability.post('/', async (c) => {
  const cuerpo = comoObjeto(await c.req.json().catch(() => null), 'El cuerpo');
  const instante = parsearInstante(cuerpo['at']);
  const miembros = parsearMiembros(cuerpo['members']);

  const resueltos = miembros.map((miembro) => {
    const estado = resolverEstado(miembro, instante);
    return {
      id: miembro.id,
      localTime: estado.localTime,
      localDate: estado.localDate,
      localWeekday: estado.localWeekday,
      utcOffsetMinutes: estado.utcOffsetMinutes,
      status: estado.status,
      statusLabel: estado.statusLabel,
      statusDetail: estado.statusDetail,
    };
  });

  resueltos.sort((x, y) => PRIORIDAD[x.status] - PRIORIDAD[y.status]);

  return c.json({
    at: instante.toISOString(),
    availableCount: resueltos.filter((m) => m.status === 'AVAILABLE').length,
    totalCount: resueltos.length,
    members: resueltos,
  });
});
