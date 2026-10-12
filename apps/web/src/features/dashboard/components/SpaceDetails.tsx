import { useState } from 'react';
import { DeleteDialog } from '../../../components/ui/DeleteDialog';
import { forgetPublishedDrafts } from '../../drafts/lib/draft-storage';
import { request } from '../../../lib/api-client';
import { ArrowUpRight, Copy, Headphones, Trash2, X } from 'lucide-react';
import type { AccountSummary, OwnedRoomInfo } from '@catsketch/shared';
import { GuestAvatar } from '../../avatars/components/GuestAvatar';
export function SpaceDetails({
  room,
  account,
  onClose,
  notify,
  onDeleted,
}: {
  room: OwnedRoomInfo;
  account: AccountSummary;
  onClose: () => void;
  notify: (message: string) => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${room.roomCode}`);
      notify('Invitation link copied. Guests can join with just their name.');
    } catch {
      notify('Could not copy. Open the space to copy its invitation link.');
    }
  };
  const date = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  return (
    <aside className="space-details" aria-labelledby="space-detail-title">
      <div className="detail-heading">
        <span className="eyebrow">SPACE DETAILS</span>
        <button className="icon-button" onClick={onClose} aria-label="Close space details">
          <X size={18} />
        </button>
      </div>
      <h2 id="space-detail-title">{room.title}</h2>
      <div className="detail-owner">
        <GuestAvatar guestId={account.id} name={account.name} />
        <div>
          <strong>{account.name}</strong>
          <span>Space owner · You</span>
        </div>
      </div>
      <dl>
        <div>
          <dt>Created</dt>
          <dd>{date(room.createdAt)}</dd>
        </div>
        <div>
          <dt>Last saved</dt>
          <dd>{date(room.updatedAt)}</dd>
        </div>
        <div>
          <dt>Whiteboard objects</dt>
          <dd>{room.elementCount}</dd>
        </div>
        <div>
          <dt>Saved messages</dt>
          <dd>{room.messageCount}</dd>
        </div>
        <div>
          <dt>Guest visits</dt>
          <dd>{room.guestCount}</dd>
        </div>
        <div>
          <dt>Connected now</dt>
          <dd>
            {room.participantCount} / {room.maxParticipants ?? 'unlimited'}
          </dd>
        </div>
        <div>
          <dt>Room code</dt>
          <dd className="room-code">{room.roomCode}</dd>
        </div>
      </dl>
      <div className="detail-audio">
        <Headphones size={16} />
        <span>{room.audioEnabled ? 'Audio calls available' : 'Audio calls not configured'}</span>
      </div>
      <p className="detail-hint">
        Your whiteboard and chat stay saved. Guests join without an account.
      </p>
      <button className="button button-outline" onClick={copy}>
        <Copy size={16} />
        Copy invitation
      </button>
      <a className="button button-primary" href={`/room/${room.roomCode}`}>
        Open whiteboard <ArrowUpRight size={17} />
      </a>
      <button className="button button-danger" onClick={() => setDeleting(true)}>
        <Trash2 size={15} />
        Delete space
      </button>
      {deleting && (
        <DeleteDialog
          title="Delete this space?"
          description={`“${room.title}” and all its whiteboard objects, messages, and participation records will be permanently removed. Everyone will be disconnected. Deleting does not restore a free creation.`}
          onClose={() => setDeleting(false)}
          onDelete={async () => {
            await request(`/sessions/${room.roomCode}`, undefined, undefined, 'DELETE');
            forgetPublishedDrafts([room.roomCode]);
            onDeleted();
          }}
        />
      )}
    </aside>
  );
}
