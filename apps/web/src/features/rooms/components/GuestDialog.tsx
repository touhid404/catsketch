import { useEffect, useState } from 'react';
import { ArrowRight, LoaderCircle, X } from 'lucide-react';
import type { GuestSession, RoomInfo } from '@syncspace/shared';
import type { Template } from '../../landing/types';
import { request } from '../../../lib/api-client';
export default function GuestModal({
  kind,
  roomCode,
  template,
  onClose,
  onEnter,
}: {
  kind: 'create' | 'join';
  roomCode?: string;
  template: Template;
  onClose: () => void;
  onEnter: (session: GuestSession) => void;
}) {
  const [name, setName] = useState(() => localStorage.getItem('syncspace:name') || '');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [loading, setLoading] = useState(!!roomCode);
  useEffect(() => {
    if (!roomCode) return;
    let active = true;
    request<RoomInfo>(`/sessions/${roomCode}`)
      .then((info) => {
        if (active) setRoom(info);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [roomCode]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose, busy]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Enter your name so your teammates know it’s you.');
      return;
    }
    setBusy(true);
    try {
      let session: GuestSession;
      if (kind === 'create') {
        const { makeTemplate } = await import('../lib/templates');
        session = await request<GuestSession>('/sessions', {
          username: name.trim(),
          title: title.trim() || 'Untitled space',
          elements: makeTemplate(template),
        });
      } else {
        const target = roomCode || /(?:\/room\/)?([\w-]{12})\/?(?:[?#].*)?$/.exec(link.trim())?.[1];
        if (!target)
          throw new Error('Paste a SyncSpace invitation link or a 12-character room code.');
        session = await request<GuestSession>(`/sessions/${target}/join`, {
          username: name.trim(),
        });
      }
      onEnter(session);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the room.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="guest-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-title"
      >
        <button
          className="modal-close icon-button"
          onClick={onClose}
          aria-label="Close dialog"
          disabled={busy}
        >
          <X size={21} />
        </button>
        <div className="modal-symbol">{kind === 'create' ? '✳' : '↗'}</div>
        <div className="eyebrow">
          {kind === 'create' ? 'MAKE ROOM FOR IDEAS' : 'YOU’RE INVITED'}
        </div>
        <h2 id="guest-title">
          {kind === 'create' ? 'A fresh space. A fresh start.' : room?.title || 'Come on in.'}
        </h2>
        <p>
          {kind === 'create'
            ? 'All you need is a name. Your people can join with a link.'
            : 'Pick a name, pull up a chair, and get into the flow.'}
        </p>
        <form onSubmit={submit}>
          <label htmlFor="guest-name">Your name</label>
          <input
            id="guest-name"
            autoFocus
            autoComplete="nickname"
            placeholder="e.g. Alex"
            maxLength={32}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            required
          />
          {kind === 'create' ? (
            <>
              <label htmlFor="space-title">
                Space name <span>optional</span>
              </label>
              <input
                id="space-title"
                placeholder="e.g. The next big thing"
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
              />
            </>
          ) : (
            !roomCode && (
              <>
                <label htmlFor="invite-link">Invitation link or room code</label>
                <input
                  id="invite-link"
                  placeholder="Paste your invitation here"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  disabled={busy}
                  required
                />
              </>
            )
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button button-primary"
            type="submit"
            disabled={busy || loading || (!!roomCode && !room)}
          >
            {busy || loading ? (
              <>
                <LoaderCircle size={18} className="spin" />{' '}
                {loading ? 'Finding your space…' : 'Opening your space…'}
              </>
            ) : (
              <>
                {kind === 'create' ? 'Create my space' : 'Join this space'} <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
        <div className="modal-footnote">No account. No password. Just you.</div>
      </section>
    </div>
  );
}
