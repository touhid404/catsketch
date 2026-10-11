import type { ChatMessage, Participant, SceneElement } from '@syncspace/shared';
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
export type GuestRecord = Participant & { leftAt: string | null };
export type SessionRecord = {
  roomCode: string;
  title: string;
  createdAt: string;
  expiresAt: string;
  revision: number;
  elements: SceneElement[];
  guests: GuestRecord[];
  messages: ChatMessage[];
};
export interface Repository {
  get(code: string): Promise<SessionRecord | undefined>;
  put(room: SessionRecord): Promise<void>;
  purgeExpired(): Promise<void>;
  close(): Promise<void>;
}
