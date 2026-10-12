import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import cron, { type ScheduledTask } from 'node-cron';

@Injectable()
export class KeepAliveService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(KeepAliveService.name);
  private task?: ScheduledTask;
  private pending?: AbortController;

  onApplicationBootstrap() {
    if (process.env.NODE_ENV !== 'production' || this.task) return;
    const configured = process.env.APP_URL?.trim() || process.env.WEB_ORIGIN?.split(',')[0]?.trim();
    if (!configured) {
      this.logger.warn('The website URL is not set. The production keep-alive cron is disabled.');
      return;
    }
    let url: URL;
    try {
      url = new URL(configured);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        throw new Error('Invalid ping URL');
      url = new URL('/api/keep-alive', url);
    } catch {
      throw new Error('The website URL must be an HTTP or HTTPS URL without embedded credentials.');
    }
    this.task = cron.schedule(
      '*/14 * * * *',
      async () => {
        const controller = new AbortController();
        this.pending = controller;
        try {
          const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
          });
          await response.text();
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          this.logger.log(`Don't Sleep ........... I am alive: ${url.origin}${url.pathname}`);
        } catch (error) {
          if (!controller.signal.aborted)
            this.logger.error(
              `[CRON] Error pinging self: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        } finally {
          if (this.pending === controller) this.pending = undefined;
        }
      },
      { name: 'catsketch-keep-alive', timezone: 'UTC', noOverlap: true },
    );
    this.logger.log('Production keep-alive cron enabled (*/14 * * * *).');
  }

  async onApplicationShutdown() {
    this.pending?.abort();
    await this.task?.destroy();
    this.task = undefined;
  }
}
