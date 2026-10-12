import { Body, Controller, Delete, Inject, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { assertOrigin } from '../../common/security/origin';
import { RequestLimit } from '../../common/security/request-limit';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../infrastructure/persistence/account.repository';
import { AuthService, ACCOUNT_COOKIE } from '../auth/auth.service';
import { RoomsService } from '../rooms/rooms.service';
import { CallsService } from '../calls/calls.service';
@Controller()
export class AccountsController {
  private limits = new RequestLimit();
  constructor(
    @Inject(AuthService) private auth: AuthService,
    @Inject(RoomsService) private rooms: RoomsService,
    @Inject(CallsService) private calls: CallsService,
    @Inject(ACCOUNT_REPOSITORY) private accounts: AccountRepository,
  ) {}
  @Delete('sessions/:code') async deleteSpace(@Param('code') code: string, @Req() req: Request) {
    assertOrigin(req);
    const user = await this.auth.require(req.headers.cookie);
    const room = await this.rooms.requireOwner(code, user.id);
    const resume = await this.rooms.prepareDeletion([code]);
    try {
      await this.calls.removeData(
        [code],
        room.guests.map((guest) => guest.guestId),
      );
      await this.rooms.deleteOwned(code, user.id);
      return { deleted: true };
    } finally {
      resume();
    }
  }
  @Delete('account') async deleteAccount(
    @Body() input: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    assertOrigin(req);
    this.limits.check(req.ip || 'unknown', 5);
    const user = await this.auth.confirmPassword(req.headers.cookie, input);
    const reopen = this.auth.beginClose(user.id);
    const resumeAccount = await this.rooms.prepareAccountDeletion(user.id);
    try {
      const data = await this.accounts.deletionData(user.id);
      const resume = await this.rooms.prepareDeletion(data.affectedCodes);
      try {
        await this.calls.removeData(data.ownedCodes, data.guestIds, data.affectedCodes);
        await this.accounts.deleteAccount(user.id);
        this.rooms.accountDeleted(user.id, data);
        res.clearCookie(ACCOUNT_COOKIE, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/api',
        });
        return { deleted: true };
      } finally {
        resume();
      }
    } finally {
      resumeAccount();
      reopen();
    }
  }
}
