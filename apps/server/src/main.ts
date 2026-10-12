import './config/env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { serveWeb } from './common/web/serve-web';
async function main() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5)
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5.');
  app.set('trust proxy', proxyHops);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'", "'wasm-unsafe-eval'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
          'connect-src': [
            "'self'",
            'https:',
            'wss:',
            ...(process.env.NODE_ENV === 'production' ? [] : ['ws:']),
          ],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'media-src': ["'self'", 'blob:'],
          'worker-src': ["'self'", 'blob:'],
        },
      },
    }),
  );
  app.enableCors({
    credentials: true,
    origin: (process.env.WEB_ORIGIN || 'http://localhost:5173').split(','),
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  if (process.env.NODE_ENV === 'production' || process.env.SERVE_WEB === 'true') serveWeb(app);
  await app.listen(Number(process.env.PORT || 3001), '0.0.0.0');
}
void main();
