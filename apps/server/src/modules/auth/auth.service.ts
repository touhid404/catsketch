import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import {
  emailSchema,
  passwordSchema,
  usernameSchema,
  type AccountSummary,
} from '@catsketch/shared';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
  type AccountRecord,
} from '../../infrastructure/persistence/account.repository';
import { hashPassword, verifyPassword } from './password.service';
export const ACCOUNT_COOKIE = 'syncspace_account';
export const AUTH_TTL_MS = 30 * 86400000;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
@Injectable()
export class AuthService {
  private closing = new Set<string>();
  // Equalize password derivation for unknown accounts without hashing on every request.
  private dummyHash = hashPassword(randomBytes(32).toString('hex'));
  constructor(@Inject(ACCOUNT_REPOSITORY) private repository: AccountRepository) {}
  summary(account: AccountRecord): AccountSummary {
    const { id, email, name, plan, createdRoomsCount, createdAt } = account;
    return {
      id,
      email,
      name,
      plan,
      createdRoomsCount,
      createdAt,
      creationLimit: account.creationLimit,
      maxParticipants: account.maxParticipants,
      remainingCreations:
        account.creationLimit !== null
          ? Math.max(0, account.creationLimit - createdRoomsCount)
          : null,
    };
  }
  async register(input: unknown) {
    const data = z
      .object({ email: emailSchema, name: usernameSchema, password: passwordSchema })
      .parse(input);
    const account = await this.repository.createAccount(
      data.email,
      data.name,
      await hashPassword(data.password),
    );
    return this.session(account);
  }
  async login(input: unknown) {
    const data = z
      .object({ email: emailSchema, password: z.string().min(1).max(128) })
      .parse(input);
    const account = await this.repository.findAccountByEmail(data.email);
    const matches = await verifyPassword(
      data.password,
      account?.passwordHash || (await this.dummyHash),
    );
    if (!account || !matches) throw new UnauthorizedException('Email or password is incorrect.');
    return this.session(account);
  }
  private async session(account: AccountRecord) {
    const token = randomBytes(32).toString('base64url');
    await this.repository.saveAuthSession({
      tokenHash: digest(token),
      userId: account.id,
      expiresAt: new Date(Date.now() + AUTH_TTL_MS).toISOString(),
    });
    return { token, account: this.summary(account) };
  }
  readCookie(header?: string) {
    return (
      header
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${ACCOUNT_COOKIE}=`))
        ?.slice(ACCOUNT_COOKIE.length + 1) || ''
    );
  }
  async optional(header?: string) {
    const token = this.readCookie(header);
    if (!/^[\w-]{43}$/.test(token)) return null;
    const user = await this.repository.findAuthSession(digest(token));
    return user && !this.closing.has(user.id) ? this.summary(user) : null;
  }
  async require(header?: string) {
    const user = await this.optional(header);
    if (!user || this.closing.has(user.id))
      throw new UnauthorizedException(
        'Sign in to share a space. Guests can still join with a name.',
      );
    return user;
  }
  beginClose(userId: string) {
    this.closing.add(userId);
    return () => this.closing.delete(userId);
  }
  async logout(header?: string) {
    const token = this.readCookie(header);
    if (token) await this.repository.deleteAuthSession(digest(token));
  }
  async confirmPassword(header: string | undefined, input: unknown) {
    const user = await this.require(header);
    const { password } = z.object({ password: z.string().min(1).max(128) }).parse(input);
    const account = await this.repository.findAccountByEmail(user.email);
    if (!account || !(await verifyPassword(password, account.passwordHash)))
      throw new UnauthorizedException('Your current password is incorrect.');
    return user;
  }
}
