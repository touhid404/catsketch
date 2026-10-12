import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
/** Serve the Vite build beside the API in production, preserving SPA deep links. */
export function serveWeb(app: NestExpressApplication) {
  const directory = path.resolve(__dirname, '../../../../web/dist');
  const index = path.join(directory, 'index.html');
  if (!existsSync(index))
    throw new Error('Frontend build is missing. Run npm run build before starting production.');
  app.useStaticAssets(path.join(directory, 'assets'), {
    prefix: '/assets/',
    immutable: true,
    maxAge: '1y',
  });
  app.useStaticAssets(directory, { index: false, maxAge: 0 });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method !== 'GET' ||
      /^\/(?:api|socket\.io|assets)(?:\/|$)/.test(req.path) ||
      path.extname(req.path) ||
      !req.accepts('html')
    )
      return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
}
