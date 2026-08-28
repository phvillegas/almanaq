/**
 * `POST /v1/calendar` — alimenta la vista de mes.
 *
 * Devuelve SOLO los días con conflictos. Los días ausentes están limpios: mandar el
 * mes entero con `conflictCount: 0` sería el 90% de la respuesta sin información.
 * Ver PLAN.md sección 4.
 */

import { Hono } from 'hono';

import { resolverConflictoDelDia } from '../domain/status.js';
import { comoObjeto, expandirRango, parsearFecha, parsearMiembros } from './entrada.js';

export const calendar = new Hono();

calendar.post('/', async (c) => {
  const cuerpo = comoObjeto(await c.req.json().catch(() => null), 'El cuerpo');
  const desde = parsearFecha(cuerpo['from'], '`from`');
  const hasta = parsearFecha(cuerpo['to'], '`to`');
  const miembros = parsearMiembros(cuerpo['members']);

  const dias = [];

  for (const fecha of expandirRango(desde, hasta)) {
    const conflictos = [];

    for (const miembro of miembros) {
      const conflicto = resolverConflictoDelDia(miembro, fecha);
      if (conflicto) {
        conflictos.push({
          memberId: miembro.id,
          reason: conflicto.reason,
          detail: conflicto.detail,
        });
      }
    }

    if (conflictos.length > 0) {
      dias.push({ date: fecha, conflictCount: conflictos.length, conflicts: conflictos });
    }
  }

  return c.json({ days: dias });
});
