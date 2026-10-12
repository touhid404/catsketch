import { ArrowUpRight, Circle, Layers, MessageCircle, MoreHorizontal, Users } from 'lucide-react';
import type { OwnedRoomInfo } from '@catsketch/shared';
export function SpaceCard({ room, onDetails }: { room: OwnedRoomInfo; onDetails: () => void }) {
  return (
    <article className="space-card">
      <div className="space-card-preview">
        <Layers size={32} strokeWidth={1.25} />
        <span>
          {room.elementCount
            ? `${room.elementCount} ${room.elementCount === 1 ? 'object' : 'objects'} on your board`
            : 'A canvas full of possibility'}
        </span>
        <span className={`space-live ${room.participantCount ? 'active' : ''}`}>
          <Circle size={7} fill="currentColor" />
          {room.participantCount ? `${room.participantCount} here now` : 'Saved space'}
        </span>
      </div>
      <div className="space-card-body">
        <div className="space-card-title">
          <h3>{room.title}</h3>
          <button
            className="icon-button"
            onClick={onDetails}
            aria-label={`View details for ${room.title}`}
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
        <p>
          Created{' '}
          {new Date(room.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
        <div className="space-card-stats">
          <span>
            <Users size={14} />
            {room.maxParticipants === null
              ? 'Unlimited people'
              : `${room.maxParticipants} people max`}
          </span>
          <span>
            <MessageCircle size={14} />
            {room.messageCount} messages
          </span>
        </div>
        <div className="space-card-actions">
          <button className="text-button" onClick={onDetails}>
            Space details
          </button>
          <a className="button button-outline button-small" href={`/room/${room.roomCode}`}>
            Open space <ArrowUpRight size={15} />
          </a>
        </div>
      </div>
    </article>
  );
}
