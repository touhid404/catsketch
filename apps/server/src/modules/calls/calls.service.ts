import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { StreamClient } from '@stream-io/node-sdk';
import { RoomsService } from '../rooms/rooms.service';
@Injectable()
export class CallsService {
  private client?: StreamClient;
  private callType = process.env.STREAM_CALL_TYPE || 'default';
  constructor(@Inject(RoomsService) private rooms: RoomsService) {
    if (process.env.STREAM_API_KEY && process.env.STREAM_API_SECRET)
      this.client = new StreamClient(process.env.STREAM_API_KEY, process.env.STREAM_API_SECRET);
  }
  async credentials(token: string, code: string) {
    const { room, guest } = await this.rooms.authorize(token, code);
    if (!this.client)
      throw new ServiceUnavailableException(
        'Audio calls are not available in this space yet. You can keep drawing and chatting together.',
      );
    try {
      await this.client.upsertUsers([{ id: guest.guestId, name: guest.username, role: 'user' }]);
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
            audio: { mic_default_on: false, speaker_default_on: true, default_device: 'speaker' },
            screensharing: { enabled: false, target_resolution: { width: 1920, height: 1080 } },
          },
        },
      });
      const access = this.client.generateCallToken({
        user_id: guest.guestId,
        call_cids: [`${this.callType}:${code}`],
        exp: Math.min(
          Math.floor(Date.now() / 1000) + 600,
          Math.floor(Date.parse(room.expiresAt) / 1000),
        ),
      });
      return {
        token: access,
        apiKey: process.env.STREAM_API_KEY!,
        callId: code,
        callType: this.callType,
        user: { id: guest.guestId, name: guest.username },
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
