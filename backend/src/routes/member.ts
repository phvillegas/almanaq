/**
 * `POST /v1/member/detail` — one person's detail screen.
 *
 * See PLAN.md sections 4 and 7.3.
 */

import { Hono } from 'hono';

import { resolveLocale } from '../domain/i18n.js';
import { resolveDetail } from '../domain/status.js';
import { asObject, parseInstant, parseMember } from './input.js';

export const member = new Hono();

member.post('/detail', async (c) => {
  const body = asObject(await c.req.json().catch(() => null), 'The body');
  const parsed = parseMember(body['member'], '`member`');
  const instant = parseInstant(body['at']);
  const locale = resolveLocale(c.req.header('accept-language'));

  return c.json(resolveDetail(parsed, instant, locale));
});
