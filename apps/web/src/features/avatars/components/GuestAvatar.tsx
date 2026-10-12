import { fancyCatImage } from '../lib/fancy-cat';
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
      src={fancyCatImage(guestId)}
      alt={`${name}'s fancy cat avatar`}
    />
  );
}
