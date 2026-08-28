/**
 * `GET /v1/locations/search?q=tel+aviv` — autocompletado al agregar un miembro.
 *
 * Ver PLAN.md sección 4.
 */

import { Hono } from 'hono';

import { buscarCiudades } from '../domain/locations.js';

export const locations = new Hono();

locations.get('/search', (c) => {
  const consulta = c.req.query('q') ?? '';
  const limiteCrudo = Number(c.req.query('limit'));
  const limite = Number.isFinite(limiteCrudo) && limiteCrudo > 0 ? limiteCrudo : undefined;

  // Una consulta corta o vacía devuelve una lista vacía, no un error: el cliente
  // llama a esto en cada tecla y el estado normal mientras se tipea es "todavía nada".
  return c.json({ results: buscarCiudades(consulta, limite) });
});
