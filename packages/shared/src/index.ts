import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your name.')
  .max(32, 'Use 32 characters or fewer.');
const finite = z.number().finite().min(-1e7).max(1e7);
export const elementSchema = z
  .object({
    id: z.string().min(1).max(128),
    type: z.enum([
      'rectangle',
      'diamond',
      'ellipse',
      'line',
      'arrow',
      'text',
      'freedraw',
      'frame',
      'magicframe',
      'embeddable',
    ]),
    x: finite,
    y: finite,
    width: finite,
    height: finite,
    version: z.number().int().min(1).max(1e9),
    versionNonce: z.number().int().min(0).max(4294967295),
    isDeleted: z.boolean(),
    index: z.string().max(128).nullable().optional(),
    text: z.string().max(20000).optional(),
    originalText: z.string().max(20000).optional(),
    points: z
      .array(z.tuple([finite, finite]))
      .max(10000)
      .optional(),
    link: z
      .string()
      .max(2000)
      .refine((v) => /^https?:\/\//i.test(v), 'Only web links are supported.')
      .nullable()
      .optional(),
  })
  .passthrough()
  .refine((v) => JSON.stringify(v).length <= 100000, 'Element is too large.');
export type SceneElement = z.infer<typeof elementSchema>;
export const sceneSchema = z.array(elementSchema).max(5000);
export const deltaSchema = z.array(elementSchema).max(500);
export const cursorSchema = z.object({
  x: finite,
  y: finite,
  button: z.enum(['up', 'down']).default('up'),
});
export type Cursor = z.infer<typeof cursorSchema>;
export type Participant = {
  guestId: string;
  avatarSeed?: string;
  username: string;
  color: string;
  joinedAt: string;
};
export type ChatMessage = {
  id: string;
  guestId: string;
  avatarSeed?: string;
  username: string;
  text: string;
  createdAt: string;
};
export type RoomInfo = {
  roomCode: string;
  title: string;
  createdAt: string;
  expiresAt: string | null;
  participantCount: number;
  audioEnabled: boolean;
  maxParticipants: number | null;
};
export type GuestSession = {
  room: RoomInfo;
  guest: Participant;
  token: string;
};
export type OwnedRoomInfo = RoomInfo & {
  updatedAt: string;
  elementCount: number;
  messageCount: number;
  guestCount: number;
};
export type SyncState = {
  elements: SceneElement[];
  revision: number;
  participants: Participant[];
  messages: ChatMessage[];
};
export type Ack<T> = { ok: true; data: T } | { ok: false; error: string };

/** Higher element version wins. Equal versions use Excalidraw's lower nonce tie-break.
 * Deletion is a versioned tombstone: never drop it during reconciliation. */
export function mergeScene(
  current: readonly SceneElement[],
  incoming: readonly SceneElement[],
): SceneElement[] {
  const elements = new Map(current.map((element) => [element.id, element]));
  for (const next of incoming) {
    const previous = elements.get(next.id);
    if (
      !previous ||
      next.version > previous.version ||
      (next.version === previous.version && next.versionNonce < previous.versionNonce)
    )
      elements.set(next.id, next);
  }
  return [...elements.values()].sort((a, b) => {
    const ai = a.index ?? '',
      bi = b.index ?? '';
    return ai < bi ? -1 : ai > bi ? 1 : a.id.localeCompare(b.id);
  });
}
export function fingerprint(element: SceneElement): string {
  return `${element.version}:${element.versionNonce}`;
}

export type Account = {
  id: string;
  email: string;
  name: string;
  plan: 'FREE' | 'PRO';
  createdRoomsCount: number;
  createdAt: string;
};
export type AccountSummary = Account & {
  creationLimit: number | null;
  remainingCreations: number | null;
  maxParticipants: number | null;
};
export const FREE_ROOM_LIMIT = 5;
export const FREE_PARTICIPANT_LIMIT = 10;
export const emailSchema = z
  .string()
  .trim()
  .email('Enter a valid email address.')
  .max(254)
  .transform((value) => value.toLowerCase());
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters for your password.')
  .max(128);
