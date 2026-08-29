/**
 * `GET /v1/locations/search?q=tel+aviv` — autocomplete when adding a member.
 *
 * See PLAN.md section 4.
 */

import { Hono } from 'hono';

import { resolveLocale } from '../domain/i18n.js';
import { searchCities } from '../domain/locations.js';

export const locations = new Hono();

locations.get('/search', (c) => {
  const query = c.req.query('q') ?? '';
  const rawLimit = Number(c.req.query('limit'));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : undefined;
  const locale = resolveLocale(c.req.header('accept-language'));

  // A short or empty query returns an empty list rather than an error: the client
  // calls this on every keystroke, and "nothing yet" is the normal state while typing.
  return c.json({ results: searchCities(query, locale, limit) });
});
