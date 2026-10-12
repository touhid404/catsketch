import type { GuestSession, RoomInfo } from '@catsketch/shared';
export function loadGuest(code: string): GuestSession | null {
  try {
    const session = JSON.parse(sessionStorage.getItem(`syncspace:guest:${code}`) || 'null');
    return session?.room?.roomCode === code && session?.token ? session : null;
  } catch {
    return null;
  }
}
export function rememberGuest(session: GuestSession) {
  sessionStorage.setItem(`syncspace:guest:${session.room.roomCode}`, JSON.stringify(session));
  localStorage.setItem('syncspace:name', session.guest.username);
  const rooms = recentRooms().filter((room) => room.roomCode !== session.room.roomCode);
  localStorage.setItem('syncspace:recent', JSON.stringify([session.room, ...rooms].slice(0, 4)));
}
export function recentRooms(): RoomInfo[] {
  try {
    return JSON.parse(localStorage.getItem('syncspace:recent') || '[]').filter(
      (room: RoomInfo) => !room.expiresAt || Date.parse(room.expiresAt) > Date.now(),
    );
  } catch {
    return [];
  }
}
