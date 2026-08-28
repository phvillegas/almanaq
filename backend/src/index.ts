/**
 * Servidor de Almanaq.
 *
 * Sin base de datos, sin autenticación y sin estado: el equipo vive en el dispositivo
 * y viaja en cada request. Ver PLAN.md sección 3.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { availability } from './routes/availability.js';
import { calendar } from './routes/calendar.js';
import { locations } from './routes/locations.js';
import { member } from './routes/member.js';
import { ErrorDeEntrada } from './routes/entrada.js';

export const app = new Hono();

app.route('/v1/availability', availability);
app.route('/v1/calendar', calendar);
app.route('/v1/member', member);
app.route('/v1/locations', locations);

/**
 * Forma única de error. No está en el contrato de PLAN.md sección 4, que solo
 * especifica las respuestas exitosas: queda a confirmar antes de congelarlo.
 */
app.onError((error, c) => {
  if (error instanceof ErrorDeEntrada) {
    return c.json({ error: { code: error.codigo, message: error.message } }, 400);
  }
  console.error(error);
  return c.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, 500);
});

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Ruta inexistente' } }, 404));

// Solo se levanta el servidor si este archivo se ejecutó directamente. Los tests
// importan `app` y le hablan por `app.request()`, sin abrir ningún puerto.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env['PORT']) || 3000;
  serve({ fetch: app.fetch, port });
  console.log(`Almanaq escuchando en http://localhost:${port}`);
}
