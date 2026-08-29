/**
 * `POST /v1/calendar` — feeds the month view.
 *
 * Returns ONLY the days that have conflicts. Absent days are clear: sending the whole
 * month with `conflictCount: 0` would be 90% of the payload carrying no information.
 * See PLAN.md section 4.
 */

import { Hono } from 'hono';

import { resolveLocale } from '../domain/i18n.js';
import { resolveDayConflict } from '../domain/status.js';
import { asObject, expandRange, parseDate, parseMembers } from './input.js';

export const calendar = new Hono();

calendar.post('/', async (c) => {
  const body = asObject(await c.req.json().catch(() => null), 'The body');
  const from = parseDate(body['from'], '`from`');
  const to = parseDate(body['to'], '`to`');
  const members = parseMembers(body['members']);
  const locale = resolveLocale(c.req.header('accept-language'));

  const days = [];

  for (const date of expandRange(from, to)) {
    const conflicts = [];

    for (const member of members) {
      const conflict = resolveDayConflict(member, date, locale);
      if (!conflict) continue;
      conflicts.push({
        memberId: member.id,
        reason: conflict.reason,
        detail: conflict.detail,
      });
    }

    if (conflicts.length === 0) continue;
    days.push({ date, conflictCount: conflicts.length, conflicts });
  }

  return c.json({ days });
});
