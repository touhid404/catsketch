import { useState } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import type { AccountSummary } from '@catsketch/shared';
import { GuestAvatar } from '../../avatars/components/GuestAvatar';
import { CatIllustration } from '../../avatars/components/CatIllustration';
import { DeleteDialog } from '../../../components/ui/DeleteDialog';
import { request } from '../../../lib/api-client';
export default function ProfilePage({
  account,
  onDeleted,
}: {
  account: AccountSummary;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <section className="profile-page" aria-labelledby="profile-title">
      <header>
        <span className="eyebrow">YOUR CREATIVE IDENTITY</span>
        <h1 id="profile-title">Your profile.</h1>
        <p>A familiar face in every space you join.</p>
      </header>
      <div className="profile-identity">
        <GuestAvatar guestId={account.id} name={account.name} />
        <div>
          <h2>{account.name}</h2>
          <p>{account.email}</p>
          <span className="plan-tag">{account.plan === 'PRO' ? 'PREMIUM' : 'FREE PLAN'}</span>
        </div>
        <CatIllustration variant="wave" />
      </div>
      <div className="profile-info">
        <article>
          <span>Display name</span>
          <strong>{account.name}</strong>
          <p>Your saved name and cat avatar follow you into your spaces.</p>
        </article>
        <article>
          <span>Member since</span>
          <strong>
            {new Date(account.createdAt).toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </strong>
          <p>
            {account.createdRoomsCount} of {account.creationLimit ?? 'unlimited'} shared spaces
            created.
          </p>
        </article>
        <article>
          <ShieldCheck size={21} />
          <strong>Protected sign-in</strong>
          <p>Your password is never stored as plain text. Sign out when using a shared device.</p>
        </article>
      </div>
      <section className="danger-zone">
        <div>
          <h2>Delete your account</h2>
          <p>
            Permanently remove your account, every space you own, their whiteboards, messages and
            participants, and your visits and messages in other spaces.
          </p>
        </div>
        <button className="button button-danger button-small" onClick={() => setDeleting(true)}>
          <Trash2 size={15} />
          Delete account
        </button>
      </section>
      {deleting && (
        <DeleteDialog
          title="Leave CatSketch?"
          description="This permanently deletes your account and all spaces you own, including their messages and whiteboards. Your participation records and messages in other spaces are removed too. This cannot be undone."
          passwordRequired
          onClose={() => setDeleting(false)}
          onDelete={async (password) => {
            await request('/account', { password }, undefined, 'DELETE');
            onDeleted();
          }}
        />
      )}
    </section>
  );
}
