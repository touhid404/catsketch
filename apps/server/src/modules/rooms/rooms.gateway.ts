import { Inject } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ZodError } from 'zod';
import { cursorSchema } from '@catsketch/shared';
import { RoomsService } from './rooms.service';

@WebSocketGateway({
  maxHttpBufferSize: 1024 * 1024,
  cors: { origin: (process.env.WEB_ORIGIN || 'http://localhost:5173').split(',') },
})
export class RoomsGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer() io!: Server;
  constructor(@Inject(RoomsService) private rooms: RoomsService) {}
  afterInit(io: Server) {
    io.use((socket, next) => {
      void this.rooms
        .authorize(String(socket.handshake.auth.token || ''))
        .then(() => next())
        .catch((error) => next(new Error(error.message)));
    });
    this.rooms.events.on('revoked', (code: string, guestId: string) => {
      for (const socket of io.sockets.sockets.values())
        if (socket.data.code === code && socket.data.guestId === guestId) socket.disconnect(true);
    });
    this.rooms.events.on('expired', (code: string) => {
      io.to(code).emit('room:expired');
      io.in(code).disconnectSockets(true);
    });
    this.rooms.events.on('deleted', (code: string) => {
      io.to(code).emit('room:deleted');
      io.in(code).disconnectSockets(true);
    });
    this.rooms.events.on('reload', (code: string) => {
      this.presence(code);
      io.to(code).emit('room:reload');
    });
  }
  private rate(socket: Socket, event: string, limit: number) {
    const now = Date.now();
    const bucket = socket.data[`rate:${event}`] as { count: number; reset: number } | undefined;
    if (!bucket || bucket.reset < now)
      socket.data[`rate:${event}`] = { count: 1, reset: now + 1000 };
    else if (++bucket.count > limit)
      throw new Error('You are sending updates too quickly. Try again shortly.');
  }
  private async handle(
    socket: Socket,
    event: string,
    limit: number,
    work: (auth: Awaited<ReturnType<RoomsService['authorize']>>) => unknown,
  ) {
    try {
      this.rate(socket, event, limit);
      const auth = await this.rooms.authorize(String(socket.handshake.auth.token || ''));
      if (event !== 'join' && (!socket.data.code || socket.data.code !== auth.room.roomCode))
        throw new Error('Join the room before sending updates.');
      return { ok: true, data: await work(auth) };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof ZodError
            ? error.issues[0].message
            : error instanceof Error
              ? error.message
              : 'The request failed.',
      };
    }
  }
  private presence(code: string) {
    this.io.to(code).emit('participants:sync', this.rooms.participants(code));
  }
  @SubscribeMessage('room:join')
  join(@ConnectedSocket() socket: Socket) {
    return this.handle(socket, 'join', 5, async ({ room, guest }) => {
      const people = this.rooms.participants(room.roomCode);
      if (
        room.maxParticipants !== null &&
        people.length >= room.maxParticipants &&
        !people.some((person) => person.guestId === guest.guestId)
      )
        throw new Error('This space already has ten people. Try again when someone leaves.');
      if (!this.rooms.online.has(room.roomCode)) this.rooms.online.set(room.roomCode, new Map());
      const publicGuest = {
        guestId: guest.guestId,
        avatarSeed: guest.avatarSeed ?? guest.userId ?? guest.guestId,
        username: guest.username,
        color: guest.color,
        joinedAt: guest.joinedAt,
      };
      socket.data.code = room.roomCode;
      socket.data.guestId = guest.guestId;
      this.rooms.online.get(room.roomCode)!.set(socket.id, publicGuest);
      await socket.join(room.roomCode);
      this.presence(room.roomCode);
      socket.to(room.roomCode).emit('participant:joined', publicGuest);
      return {
        elements: room.elements,
        revision: room.revision,
        participants: this.rooms.participants(room.roomCode),
        messages: room.messages,
      };
    });
  }
  @SubscribeMessage('canvas:update')
  canvas(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    return this.handle(socket, 'canvas', 30, ({ room }) => {
      const before = new Map(room.elements.map((e) => [e.id, `${e.version}:${e.versionNonce}`]));
      const state = this.rooms.update(room, body);
      const changes = state.elements.filter(
        (e) => before.get(e.id) !== `${e.version}:${e.versionNonce}`,
      );
      this.io
        .to(room.roomCode)
        .emit('canvas:sync', { elements: changes, revision: state.revision });
      // Echo canonical versions for rejected stale edits too.
      return state;
    });
  }
  @SubscribeMessage('cursor:move')
  cursor(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    return this.handle(socket, 'cursor', 30, ({ room, guest }) => {
      const cursor = cursorSchema.parse(body);
      socket.to(room.roomCode).volatile.emit('cursor:move', { ...cursor, guestId: guest.guestId });
      return null;
    });
  }
  @SubscribeMessage('chat:send')
  chat(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    return this.handle(socket, 'chat', 5, async ({ room, guest }) => {
      const message = await this.rooms.message(room, guest, body);
      this.io.to(room.roomCode).emit('chat:message', message);
      return message;
    });
  }
  @SubscribeMessage('room:leave')
  leave(@ConnectedSocket() socket: Socket) {
    this.detach(socket);
    return { ok: true, data: null };
  }
  handleDisconnect(socket: Socket) {
    this.detach(socket);
  }
  private detach(socket: Socket) {
    const code = socket.data.code as string | undefined;
    if (!code) return;
    this.rooms.online.get(code)?.delete(socket.id);
    if (!this.rooms.online.get(code)?.size) this.rooms.online.delete(code);
    socket.leave(code);
    this.presence(code);
    socket.to(code).emit('participant:left', { guestId: socket.data.guestId });
    delete socket.data.code;
  }
}
