import { polarBearImage } from '../lib/polar-bear';
export function GuestAvatar({
  guestId,
  name,
  className = '',
}: {
  guestId: string;
  name: string;
  className?: string;
}) {
  return (
    <img
      className={`guest-avatar ${className}`}
      src={polarBearImage(guestId)}
      alt={`${name}'s polar bear avatar`}
    />
  );
}
