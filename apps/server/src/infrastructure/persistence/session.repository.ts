import type { ChatMessage, Participant, OwnedRoomInfo, SceneElement } from '@catsketch/shared';
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
export type GuestRecord = Participant & { leftAt: string | null; userId?: string | null };
export type SessionRecord = {
  roomCode: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt: string | null;
  ownerId: string | null;
  maxParticipants: number | null;
  revision: number;
  elements: SceneElement[];
  guests: GuestRecord[];
  messages: ChatMessage[];
};
export interface Repository {
  get(code: string): Promise<SessionRecord | undefined>;
  put(room: SessionRecord): Promise<void>;
  appendMessage(code: string, message: ChatMessage): Promise<void>;
  createOwned(room: SessionRecord, ownerId: string): Promise<void>;
  listOwned(ownerId: string): Promise<OwnedRoomInfo[]>;
  deleteOwned(code: string, ownerId: string): Promise<void>;
  purgeExpired(): Promise<void>;
  close(): Promise<void>;
}
