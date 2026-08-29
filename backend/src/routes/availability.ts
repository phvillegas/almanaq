/**
 * `POST /v1/availability` — the main endpoint.
 *
 * The client sends its team and an instant; it gets back statuses already resolved.
 * See PLAN.md section 4.
 */

import { Hono } from 'hono';

import { resolveLocale } from '../domain/i18n.js';
import { resolveStatus, type Status } from '../domain/status.js';
import { asObject, parseInstant, parseMembers } from './input.js';

/**
 * Order of the returned list: available first, then off hours, then weekend and
 * holiday, and unknown last. See PLAN.md section 7.1.
 *
 * The backend sorts by status and the client sorts by name within each group: the
 * backend never receives names, and the client has no business knowing which status
 * outranks which. Each side sorts by what it actually knows.
 */
const PRIORITY: Readonly<Record<Status, number>> = {
  AVAILABLE: 0,
  OFF_HOURS: 1,
  LOCAL_WEEKEND: 2,
  LOCAL_HOLIDAY: 3,
  UNKNOWN: 4,
};

export const availability = new Hono();

availability.post('/', async (c) => {
  const body = asObject(await c.req.json().catch(() => null), 'The body');
  const instant = parseInstant(body['at']);
  const members = parseMembers(body['members']);
  const locale = resolveLocale(c.req.header('accept-language'));

  const resolved = members.map((member) => {
    const status = resolveStatus(member, instant, locale);
    return {
      id: member.id,
      localTime: status.localTime,
      localDate: status.localDate,
      localWeekday: status.localWeekday,
      utcOffsetMinutes: status.utcOffsetMinutes,
      status: status.status,
      statusLabel: status.statusLabel,
      statusDetail: status.statusDetail,
    };
  });

  resolved.sort((left, right) => PRIORITY[left.status] - PRIORITY[right.status]);

  return c.json({
    at: instant.toISOString(),
    availableCount: resolved.filter((member) => member.status === 'AVAILABLE').length,
    totalCount: resolved.length,
    members: resolved,
  });
});
