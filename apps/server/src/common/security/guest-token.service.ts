import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
const claimsSchema = z.object({
  roomCode: z.string().regex(/^[A-Za-z0-9_-]{12}$/),
  guestId: z.string().uuid(),
});
export type GuestClaims = z.infer<typeof claimsSchema>;
@Injectable()
export class GuestTokenService {
  private readonly secret: string;
  constructor() {
    const secret = process.env.GUEST_TOKEN_SECRET;
    if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32))
      throw new Error('Set GUEST_TOKEN_SECRET to at least 32 random characters.');
    this.secret = secret || randomBytes(32).toString('hex');
  }
  issue(claims: GuestClaims, expiresAt: string) {
    return jwt.sign(claims, this.secret, {
      algorithm: 'HS256',
      expiresIn: Math.max(1, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000)),
      issuer: 'syncspace',
      audience: 'guest',
    });
  }
  verify(token: string): GuestClaims {
    try {
      return claimsSchema.parse(
        jwt.verify(token, this.secret, {
          algorithms: ['HS256'],
          issuer: 'syncspace',
          audience: 'guest',
        }),
      );
    } catch {
      throw new UnauthorizedException('Your guest session has ended. Rejoin with your name.');
    }
  }
}
