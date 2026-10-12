import { useCallback, useEffect, useState } from 'react';
import type { AccountSummary, OwnedRoomInfo } from '@catsketch/shared';
import { request } from '../../../lib/api-client';
export function useAccount() {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [rooms, setRooms] = useState<OwnedRoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { account: user } = await request<{ account: AccountSummary | null }>('/auth/me');
      setAccount(user);
      setRooms(user ? await request<OwnedRoomInfo[]>('/sessions/owned') : []);
      setError('');
    } catch {
      setError('Your saved spaces could not load. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const signOut = async () => {
    await request('/auth/logout', {});
    setAccount(null);
    setRooms([]);
  };
  return { account, rooms, loading, error, refresh, signOut, setAccount };
}
