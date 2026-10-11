import { Body, Controller, Get, Headers, Inject, Param, Post, Req, HttpException } from '@nestjs/common';
import type { Request } from 'express';
import { RoomsService } from './rooms.service';

@Controller('sessions')
export class RoomsController {
  private attempts = new Map<string, { count: number; resetAt: number }>();
  constructor(@Inject(RoomsService) private rooms: RoomsService) {}
  private rate(req: Request) {
    const now = Date.now(), key = req.ip || 'unknown';
    if (this.attempts.size > 10000) for (const [id, entry] of this.attempts) if (entry.resetAt < now) this.attempts.delete(id);
    const entry = this.attempts.get(key);
    if (!entry || entry.resetAt < now) this.attempts.set(key, { count: 1, resetAt: now + 60000 });
    else if (++entry.count > 20) throw new HttpException('Too many requests. Try again in a minute.', 429);
  }
  private bearer(header?: string) { return header?.startsWith('Bearer ') ? header.slice(7) : ''; }
  @Post() create(@Body() body: unknown, @Req() req: Request) { this.rate(req); return this.rooms.create(body); }
  @Get(':code') async info(@Param('code') code: string) { return this.rooms.info(await this.rooms.room(code)); }
  @Post(':code/join') join(@Param('code') code: string, @Body() body: unknown, @Req() req: Request) { this.rate(req); return this.rooms.join(code, body); }
  @Get(':code/whiteboard') snapshot(@Param('code') code: string, @Headers('authorization') header?: string) { return this.rooms.snapshot(this.bearer(header), code); }
  @Post(':code/leave') leave(@Param('code') code: string, @Headers('authorization') header?: string) { return this.rooms.leave(this.bearer(header), code); }
  @Post(':code/livekit-token') livekit(@Param('code') code: string, @Headers('authorization') header?: string) { return this.rooms.livekit(this.bearer(header), code); }
}
