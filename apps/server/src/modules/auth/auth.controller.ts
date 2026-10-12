import { Body, Controller, Get, Headers, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, ACCOUNT_COOKIE, AUTH_TTL_MS } from './auth.service';
import { assertOrigin } from '../../common/security/origin';
import { RequestLimit } from '../../common/security/request-limit';
@Controller('auth')
export class AuthController {
  private limits = new RequestLimit();
  constructor(@Inject(AuthService) private auth: AuthService) {}
  private options() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/api',
    };
  }
  private async signIn(kind: 'register' | 'login', body: unknown, req: Request, res: Response) {
    assertOrigin(req);
    this.limits.check(req.ip || 'unknown', 15);
    const result = await this.auth[kind](body);
    // Revoke the previous browser session when rotating the login cookie.
    await this.auth.logout(req.headers.cookie);
    res.cookie(ACCOUNT_COOKIE, result.token, { ...this.options(), maxAge: AUTH_TTL_MS });
    return result.account;
  }
  @Post('register') register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.signIn('register', body, req, res);
  }
  @Post('login') login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.signIn('login', body, req, res);
  }
  @Get('me') async me(@Headers('cookie') cookie?: string) {
    return { account: await this.auth.optional(cookie) };
  }
  @Post('logout') async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertOrigin(req);
    await this.auth.logout(req.headers.cookie);
    res.clearCookie(ACCOUNT_COOKIE, this.options());
    return { signedOut: true };
  }
}
