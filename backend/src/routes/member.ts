/**
 * `POST /v1/member/detail` — pantalla de detalle de una persona.
 *
 * Ver PLAN.md sección 4 y 7.3.
 */

import { Hono } from 'hono';

import { resolverDetalle } from '../domain/status.js';
import { comoObjeto, parsearInstante, parsearMiembro } from './entrada.js';

export const member = new Hono();

member.post('/detail', async (c) => {
  const cuerpo = comoObjeto(await c.req.json().catch(() => null), 'El cuerpo');
  const miembro = parsearMiembro(cuerpo['member'], '`member`');
  const instante = parsearInstante(cuerpo['at']);

  return c.json(resolverDetalle(miembro, instante));
});
