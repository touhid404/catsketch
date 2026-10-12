import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { StreamClient } from '@stream-io/node-sdk';
import { RoomsService } from '../rooms/rooms.service';
@Injectable()
export class CallsService {
  private client?: StreamClient;
  private pending = new Map<string, Set<Promise<unknown>>>();
  private callType = process.env.STREAM_CALL_TYPE || 'default';
  constructor(@Inject(RoomsService) private rooms: RoomsService) {
    if (process.env.STREAM_API_KEY && process.env.STREAM_API_SECRET)
      this.client = new StreamClient(process.env.STREAM_API_KEY, process.env.STREAM_API_SECRET);
  }
  credentials(token: string, code: string) {
    const task = this.setup(token, code);
    const tasks = this.pending.get(code) || new Set<Promise<unknown>>();
    this.pending.set(code, tasks);
    tasks.add(task);
    const done = () => {
      tasks.delete(task);
      if (!tasks.size) this.pending.delete(code);
    };
    void task.then(done, done);
    return task;
  }
  async removeData(codes: string[], guestIds: string[], affectedCodes = codes) {
    if (!this.client) return;
    await Promise.allSettled(affectedCodes.flatMap((code) => [...(this.pending.get(code) || [])]));
    try {
      for (const code of codes) {
        try {
          await this.client.video.call(this.callType, code).delete({ hard: true });
        } catch (error) {
          if ((error as { metadata?: { responseCode?: number } }).metadata?.responseCode !== 404)
            throw error;
        }
      }
      for (let index = 0; index < guestIds.length; index += 100) {
        const { users } = await this.client.queryUsers({
          payload: {
            filter_conditions: { id: { $in: guestIds.slice(index, index + 100) } },
            limit: 100,
          },
        });
        if (users.length)
          await this.client.deleteUsers({
            user_ids: users.map((user) => user.id),
            user: 'hard',
            messages: 'hard',
            conversations: 'hard',
          });
      }
    } catch {
      throw new ServiceUnavailableException(
        'Audio data cleanup could not be started. Please try deleting again shortly.',
      );
    }
  }
  private async setup(token: string, code: string) {
    const { room, guest } = await this.rooms.authorize(token, code);
    if (!this.client)
      throw new ServiceUnavailableException(
        'Audio calls are not available in this space yet. You can keep drawing and chatting together.',
      );
    try {
      await this.client.upsertUsers([
        {
          id: guest.guestId,
          name: guest.username,
          role: 'user',
          custom: { avatarSeed: guest.avatarSeed ?? guest.userId ?? guest.guestId },
        },
      ]);
      const call = this.client.video.call(this.callType, code);
      await call.getOrCreate({
        data: {
          created_by_id: guest.guestId,
          members: [{ user_id: guest.guestId }],
          settings_override: {
            video: {
              enabled: false,
              camera_default_on: false,
              target_resolution: { width: 1280, height: 720 },
            },
            limits: { max_participants: room.maxParticipants ?? 0 },
            audio: { mic_default_on: false, speaker_default_on: true, default_device: 'speaker' },
            screensharing: { enabled: false, target_resolution: { width: 1920, height: 1080 } },
          },
        },
      });
      await this.rooms.authorize(token, code);
      const access = this.client.generateCallToken({
        user_id: guest.guestId,
        call_cids: [`${this.callType}:${code}`],
        exp: Math.min(
          Math.floor(Date.now() / 1000) + 600,
          room.expiresAt
            ? Math.floor(Date.parse(room.expiresAt) / 1000)
            : Math.floor(Date.now() / 1000) + 600,
        ),
      });
      return {
        token: access,
        apiKey: process.env.STREAM_API_KEY!,
        callId: code,
        callType: this.callType,
        user: {
          id: guest.guestId,
          name: guest.username,
          custom: { avatarSeed: guest.avatarSeed ?? guest.userId ?? guest.guestId },
        },
      };
    } catch (error) {
      console.error(
        'Stream call setup failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw new ServiceUnavailableException(
        'The audio call could not be started. Try again shortly.',
      );
    }
  }
}
