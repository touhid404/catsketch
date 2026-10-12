import { useEffect, useState } from 'react';
import { ArrowRight, LoaderCircle, X } from 'lucide-react';
import type { GuestSession, RoomInfo } from '@catsketch/shared';
import { GuestAvatar } from '../../avatars/components/GuestAvatar';
import { request } from '../../../lib/api-client';
export default function GuestModal({
  defaultName,
  avatarSeed,
  roomCode,
  onClose,
  onEnter,
}: {
  defaultName?: string;
  avatarSeed?: string;
  roomCode?: string;
  onClose: () => void;
  onEnter: (session: GuestSession) => void;
}) {
  const [name, setName] = useState(
    () => defaultName || localStorage.getItem('syncspace:name') || '',
  );
  const [link, setLink] = useState(''),
    [error, setError] = useState('');
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(!!roomCode);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  useEffect(() => {
    if (!roomCode) return;
    let active = true;
    request<RoomInfo>(`/sessions/${roomCode}`)
      .then((info) => {
        if (active) setRoom(info);
      })
      .catch((error) => {
        if (active) setError(error.message);
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
      const target = roomCode || /(?:\/room\/)?([\w-]{12})\/?(?:[?#].*)?$/.exec(link.trim())?.[1];
      if (!target)
        throw new Error('Paste a CatSketch invitation link or a 12-character room code.');
      onEnter(await request<GuestSession>(`/sessions/${target}/join`, { username: name.trim() }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not open the room.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
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
        <div className="modal-symbol">↗</div>
        <div className="eyebrow">YOU’RE INVITED</div>
        <h2 id="guest-title">{room?.title || 'Come on in.'}</h2>
        <p>Pick a name, pull up a chair, and get into the flow.</p>
        {defaultName && avatarSeed && (
          <div className="guest-profile-preview">
            <GuestAvatar guestId={avatarSeed} name={defaultName} />
            <div>
              <strong>{defaultName}</strong>
              <span>Using your saved profile</span>
            </div>
          </div>
        )}
        <form onSubmit={submit}>
          <label htmlFor="guest-name">Your name</label>
          <input
            id="guest-name"
            readOnly={!!defaultName}
            autoFocus
            autoComplete="nickname"
            placeholder="e.g. Alex"
            maxLength={32}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
            required
          />
          {!roomCode && (
            <>
              <label htmlFor="invite-link">Invitation link or room code</label>
              <input
                id="invite-link"
                placeholder="Paste your invitation here"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                disabled={busy}
                required
              />
            </>
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
                <LoaderCircle size={18} className="spin" />
                {loading ? 'Finding your space…' : 'Opening your space…'}
              </>
            ) : (
              <>
                Join this space <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
        <div className="modal-footnote">
          {defaultName
            ? 'Your saved profile travels with you.'
            : 'No account. No password. Just you.'}
        </div>
      </section>
    </div>
  );
}
