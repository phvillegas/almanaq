/**
 * Almanaq server.
 *
 * No database, no authentication and no state: the team lives on the device and
 * travels in every request. See PLAN.md section 3.
 *
 * User-facing text is localized from `Accept-Language`; see `domain/i18n.ts`.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { availability } from './routes/availability.js';
import { calendar } from './routes/calendar.js';
import { locations } from './routes/locations.js';
import { member } from './routes/member.js';
import { InputError } from './routes/input.js';

export const app = new Hono();

app.route('/v1/availability', availability);
app.route('/v1/calendar', calendar);
app.route('/v1/member', member);
app.route('/v1/locations', locations);

/**
 * Single error shape. It is not in the contract in PLAN.md section 4, which only
 * specifies successful responses: still to be confirmed before freezing.
 *
 * Error messages are not localized. They address whoever is building a client, not
 * the end user.
 */
app.onError((error, c) => {
  if (error instanceof InputError) {
    return c.json({ error: { code: error.code, message: error.message } }, 400);
  }
  console.error(error);
  return c.json({ error: { code: 'INTERNAL', message: 'Internal error' } }, 500);
});

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'No such route' } }, 404));

// The server only starts when this file is run directly. Tests import `app` and talk
// to it through `app.request()`, without opening a port.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env['PORT']) || 3000;
  serve({ fetch: app.fetch, port });
  console.log(`Almanaq listening on http://localhost:${port}`);
}
