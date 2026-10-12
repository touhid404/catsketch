import { HttpException } from '@nestjs/common';
export class RequestLimit {
  private entries = new Map<string, { count: number; reset: number }>();
  check(key: string, limit: number, windowMs = 60000) {
    const now = Date.now();
    for (const [id, entry] of this.entries) if (entry.reset <= now) this.entries.delete(id);
    const entry = this.entries.get(key);
    if (!entry) this.entries.set(key, { count: 1, reset: now + windowMs });
    else if (++entry.count > limit)
      throw new HttpException('Too many requests. Try again shortly.', 429);
  }
}
