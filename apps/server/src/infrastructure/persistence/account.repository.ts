import type { Account } from '@catsketch/shared';
export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');
export type AccountRecord = Account & {
  passwordHash: string;
  createdAt: string;
  creationLimit: number | null;
  maxParticipants: number | null;
};
export type AuthRecord = { tokenHash: string; userId: string; expiresAt: string };
export type AccountDeletionData = {
  ownedCodes: string[];
  affectedCodes: string[];
  guestIds: string[];
};
export interface AccountRepository {
  createAccount(email: string, name: string, passwordHash: string): Promise<AccountRecord>;
  findAccountByEmail(email: string): Promise<AccountRecord | undefined>;
  findAuthSession(tokenHash: string): Promise<AccountRecord | undefined>;
  saveAuthSession(session: AuthRecord): Promise<void>;
  deleteAuthSession(tokenHash: string): Promise<void>;
  deletionData(userId: string): Promise<AccountDeletionData>;
  deleteAccount(userId: string): Promise<void>;
}
