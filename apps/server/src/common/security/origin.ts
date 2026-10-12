import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
/** Reject browser CSRF requests; CLI clients with no Origin cannot send browser cookies. */
export function assertOrigin(req: Request) {
  const origin = req.headers.origin;
  const allowed = (process.env.WEB_ORIGIN || 'http://localhost:5173').split(',');
  if (origin && !allowed.includes(origin))
    throw new ForbiddenException('This request came from an untrusted website.');
  if (!origin && req.headers['sec-fetch-site'] === 'cross-site')
    throw new ForbiddenException('This request came from an untrusted website.');
}
