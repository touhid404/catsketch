import { GuestAvatar } from '../../avatars/components/GuestAvatar';
import { ArrowRight } from 'lucide-react';
import type { Participant } from '@syncspace/shared';
export default function PeoplePanel({
  participants,
  guestId,
  onInvite,
}: {
  participants: Participant[];
  guestId: string;
  onInvite: () => void;
}) {
  return (
    <div className="people-panel" role="tabpanel">
      <div className="people-list">
        {participants.map((p) => (
          <div className="person-row" key={p.guestId}>
            <GuestAvatar guestId={p.guestId} name={p.username} className="person-avatar" />
            <div>
              <strong>{p.username}</strong>
              <span>{p.guestId === guestId ? 'You’re in the space' : 'Here to collaborate'}</span>
            </div>
            {p.guestId === guestId ? (
              <span className="you-badge">YOU</span>
            ) : (
              <span className="person-online" />
            )}
          </div>
        ))}
      </div>
      <button className="invite-dashed" onClick={onInvite}>
        <span className="invite-plus">+</span> There’s room for more <ArrowRight size={14} />
      </button>
      <div className="room-tip">
        <span>✳</span>
        <p>
          Good ideas don’t arrive fully formed.
          <br />
          <strong>Make a little mess together.</strong>
        </p>
      </div>
    </div>
  );
}
