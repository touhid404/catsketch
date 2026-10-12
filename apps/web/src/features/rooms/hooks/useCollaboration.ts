import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { CaptureUpdateAction, reconcileElements } from '@excalidraw/excalidraw';
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile';
import type { ExcalidrawImperativeAPI, Collaborator, SocketId } from '@excalidraw/excalidraw/types';
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import {
  fingerprint,
  mergeScene,
  type Ack,
  type ChatMessage,
  type Cursor,
  type GuestSession,
  type Participant,
  type SceneElement,
  type SyncState,
} from '@catsketch/shared';
import { fancyCatImage } from '../../avatars/lib/fancy-cat';
import { SOCKET_URL } from '../../../lib/api-client';
export function useCollaboration(
  session: GuestSession,
  notify: (message: string) => void,
  onExpired: () => void,
  onDeleted: () => void,
) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [revision, setRevision] = useState(0);
  const socket = useRef<Socket | null>(null);
  const authoritative = useRef<SceneElement[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = useRef<() => void>(() => {});
  const callbacks = useRef({ notify, onExpired, onDeleted });
  callbacks.current = { notify, onExpired, onDeleted };
  useEffect(() => {
    if (!api) return;
    let mounted = true,
      ready = false,
      sending = false,
      hasCentered = false;
    let lastCursor = 0;
    let people: Participant[] = [];
    const cursors = new Map<string, Cursor & { at: number }>();
    const s = io(SOCKET_URL, {
      auth: { token: session.token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });
    socket.current = s;
    const showPeople = () => {
      const collaborators = new Map<SocketId, Collaborator>();
      for (const person of people) {
        if (person.guestId === session.guest.guestId) continue;
        const cursor = cursors.get(person.guestId);
        collaborators.set(person.guestId as SocketId, {
          username: person.username,
          avatarUrl: fancyCatImage(person.avatarSeed ?? person.guestId),
          color: { background: person.color, stroke: person.color },
          ...(cursor && Date.now() - cursor.at < 10000
            ? {
                pointer: { x: cursor.x, y: cursor.y, tool: 'pointer' as const },
                button: cursor.button,
              }
            : {}),
        });
      }
      api.updateScene({ collaborators, captureUpdate: CaptureUpdateAction.NEVER });
    };
    const apply = (elements: SceneElement[], nextRevision: number, full = false) => {
      authoritative.current = full ? elements : mergeScene(authoritative.current, elements);
      // Use Excalidraw's supported reconciliation API to preserve in-progress local edits.
      const merged = reconcileElements(
        api.getSceneElementsIncludingDeleted(),
        authoritative.current as unknown as RemoteExcalidrawElement[],
        api.getAppState(),
      );
      api.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER });
      if (!hasCentered && merged.some((e) => !e.isDeleted)) {
        api.scrollToContent(merged, { fitToContent: true, maxZoom: 1 });
        hasCentered = true;
      }
      setRevision(nextRevision);
    };
    flush.current = () => {
      if (!mounted || !ready || !s.connected || sending) return;
      const known = new Map(authoritative.current.map((e) => [e.id, fingerprint(e)]));
      const local = api.getSceneElementsIncludingDeleted() as unknown as SceneElement[];
      const delta = local
        .filter((e) => e.type !== ('image' as string) && known.get(e.id) !== fingerprint(e))
        .slice(0, 500);
      if (!delta.length) return;
      sending = true;
      s.timeout(5000).emit(
        'canvas:update',
        delta,
        (error: Error | null, ack: Ack<{ elements: SceneElement[]; revision: number }>) => {
          sending = false;
          if (!mounted) return;
          if (error) {
            if (s.connected)
              callbacks.current.notify(
                'An update is taking longer than usual. Reconnecting will restore your space.',
              );
            return;
          }
          if (!ack.ok) {
            callbacks.current.notify(ack.error);
            return;
          }
          apply(ack.data.elements, ack.data.revision);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => flush.current(), 120);
        },
      );
    };
    s.on('connect', () => {
      ready = false;
      setStatus('connecting');
      s.timeout(5000).emit('room:join', {}, (error: Error | null, ack: Ack<SyncState>) => {
        if (!mounted) return;
        if (error) {
          callbacks.current.notify('Could not join your space. Check your connection.');
          setStatus('offline');
          return;
        }
        if (!ack.ok) {
          callbacks.current.notify(ack.error);
          setStatus('offline');
          return;
        }
        apply(ack.data.elements, ack.data.revision, true);
        people = ack.data.participants;
        setParticipants(people);
        setMessages(ack.data.messages);
        showPeople();
        ready = true;
        setStatus('live');
        flush.current();
      });
    });
    s.on(
      'canvas:sync',
      ({ elements, revision: nextRevision }: { elements: SceneElement[]; revision: number }) => {
        if (ready) apply(elements, nextRevision);
      },
    );
    s.on('participants:sync', (next: Participant[]) => {
      people = next;
      setParticipants(next);
      showPeople();
    });
    s.on('cursor:move', (cursor: Cursor & { guestId: string }) => {
      cursors.set(cursor.guestId, { ...cursor, at: Date.now() });
      showPeople();
    });
    s.on('chat:message', (message: ChatMessage) =>
      setMessages((current) =>
        current.some((m) => m.id === message.id) ? current : [...current, message].slice(-100),
      ),
    );
    s.on('room:deleted', () => {
      ready = false;
      s.disconnect();
      callbacks.current.notify('This space has been deleted by its owner.');
      callbacks.current.onDeleted();
    });
    s.on('room:reload', () => {
      s.disconnect();
      s.connect();
    });
    s.on('disconnect', (reason) => {
      ready = false;
      sending = false;
      setStatus('offline');
      if (reason === 'io server disconnect') callbacks.current.onExpired();
    });
    s.on('connect_error', (error) => {
      setStatus('offline');
      if (/guest session|expired|could not be found/i.test(error.message)) {
        callbacks.current.notify(error.message);
        callbacks.current.onExpired();
      }
    });
    s.on('room:expired', () => {
      callbacks.current.notify('This room has expired. Create a fresh space to keep going.');
      callbacks.current.onExpired();
    });
    s.on('reconnect', () => {
      lastCursor = 0;
    });
    const cursorCleanup = setInterval(showPeople, 5000);
    // Keep cursor throttling local; scene coordinates remain correct through pan/zoom.
    const pointer = (payload: { pointer: { x: number; y: number }; button: 'up' | 'down' }) => {
      if (ready && s.connected && Date.now() - lastCursor > 50) {
        lastCursor = Date.now();
        s.volatile.emit('cursor:move', {
          x: payload.pointer.x,
          y: payload.pointer.y,
          button: payload.button,
        });
      }
    };
    pointerRef.current = pointer;
    return () => {
      mounted = false;
      ready = false;
      clearTimeout(timer.current);
      clearInterval(cursorCleanup);
      s.disconnect();
      socket.current = null;
      flush.current = () => {};
      pointerRef.current = () => {};
    };
  }, [api, session.token, session.guest.guestId]);
  const pointerRef = useRef<
    (payload: { pointer: { x: number; y: number }; button: 'up' | 'down' }) => void
  >(() => {});
  const onPointerUpdate = useCallback(
    (payload: { pointer: { x: number; y: number }; button: 'up' | 'down' }) =>
      pointerRef.current(payload),
    [],
  );
  const onChange = useCallback((_elements: readonly OrderedExcalidrawElement[]) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flush.current(), 120);
  }, []);
  const sendMessage = (text: string) =>
    new Promise<void>((resolve, reject) => {
      if (!socket.current?.connected || status !== 'live')
        return reject(new Error('Reconnect to send a message.'));
      socket.current
        .timeout(5000)
        .emit('chat:send', { text }, (error: Error | null, result: Ack<ChatMessage>) =>
          error
            ? reject(new Error('Message could not be sent. Try again.'))
            : result.ok
              ? resolve()
              : reject(new Error(result.error)),
        );
    });
  return {
    api,
    setApi,
    onChange,
    onPointerUpdate,
    status,
    participants,
    messages,
    revision,
    sendMessage,
  };
}
