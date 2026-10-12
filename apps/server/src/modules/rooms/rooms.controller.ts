import { Body, Controller, Get, Headers, Inject, Param, Post, Req } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { RequestLimit } from '../../common/security/request-limit';
import { assertOrigin } from '../../common/security/origin';
import type { Request } from 'express';
import { RoomsService } from './rooms.service';

@Controller('sessions')
export class RoomsController {
  private limits = new RequestLimit();
  constructor(
    @Inject(RoomsService) private rooms: RoomsService,
    @Inject(AuthService) private auth: AuthService,
  ) {}
  private bearer(header?: string) {
    return header?.startsWith('Bearer ') ? header.slice(7) : '';
  }
  @Post() async create(@Body() body: unknown, @Req() req: Request) {
    this.limits.check(`create:${req.ip}`, 30);
    assertOrigin(req);
    return this.rooms.create(body, await this.auth.require(req.headers.cookie));
  }
  @Get('owned') async owned(@Headers('cookie') cookie?: string) {
    return this.rooms.owned((await this.auth.require(cookie)).id);
  }
  @Get(':code') async info(@Param('code') code: string) {
    return this.rooms.info(await this.rooms.room(code));
  }
  @Post(':code/join') async join(
    @Param('code') code: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    this.limits.check(`join:${req.ip}`, 60);
    return this.rooms.join(code, body, await this.auth.optional(req.headers.cookie));
  }
  @Get(':code/whiteboard') snapshot(
    @Param('code') code: string,
    @Headers('authorization') header?: string,
  ) {
    return this.rooms.snapshot(this.bearer(header), code);
  }
  @Post(':code/leave') leave(
    @Param('code') code: string,
    @Headers('authorization') header?: string,
  ) {
    return this.rooms.leave(this.bearer(header), code);
  }
}
