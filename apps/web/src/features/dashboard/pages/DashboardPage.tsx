import ProfilePage from './ProfilePage';
import { listDrafts } from '../../drafts/lib/draft-storage';
import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Grid2X2,
  Headphones,
  LayoutDashboard,
  Link,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import type { AccountSummary, OwnedRoomInfo } from '@catsketch/shared';
import { Brand } from '../../../components/ui/Brand';
import { GuestAvatar } from '../../avatars/components/GuestAvatar';
import { CatIllustration } from '../../avatars/components/CatIllustration';
import { SpaceCard } from '../components/SpaceCard';
import { SpaceDetails } from '../components/SpaceDetails';
import '../styles/dashboard.css';
export default function Dashboard({
  account,
  rooms,
  loading,
  error,
  selectedCode,
  profilePage = false,
  onAccountDeleted,
  onNavigate,
  onCreate,
  onJoin,
  onSignOut,
  onRetry,
  onPremium,
  notify,
}: {
  account: AccountSummary;
  rooms: OwnedRoomInfo[];
  loading: boolean;
  error: string;
  selectedCode?: string;
  profilePage?: boolean;
  onAccountDeleted: () => void;
  onNavigate: (path: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  onSignOut: () => void;
  onRetry: () => void;
  onPremium: () => void;
  notify: (message: string) => void;
}) {
  const [query, setQuery] = useState(''),
    [sort, setSort] = useState('newest');
  const visible = useMemo(
    () =>
      rooms
        .filter(
          (room) =>
            room.title.toLowerCase().includes(query.toLowerCase().trim()) ||
            room.roomCode.toLowerCase().includes(query.toLowerCase().trim()),
        )
        .sort((a, b) =>
          sort === 'saved'
            ? b.updatedAt.localeCompare(a.updatedAt)
            : sort === 'name'
              ? a.title.localeCompare(b.title)
              : b.createdAt.localeCompare(a.createdAt),
        ),
    [rooms, query, sort],
  );
  const selected = rooms.find((room) => room.roomCode === selectedCode);
  const active = rooms.filter((room) => room.participantCount > 0).length;
  return (
    <div className="dashboard">
      <aside className="dashboard-sidebar">
        <Brand />
        <nav aria-label="Dashboard navigation">
          <a href="/dashboard" className={profilePage ? undefined : 'selected'}>
            <LayoutDashboard size={18} />
            Your spaces
          </a>
          <a href="/dashboard/profile" className={profilePage ? 'selected' : undefined}>
            <UserRound size={18} />
            Your profile
          </a>
          <a href="/#plans">
            <Sparkles size={18} />
            Plans & pricing
          </a>
          <a href="/">
            <ArrowUpRight size={18} />
            Explore CatSketch
          </a>
        </nav>
        <div className="dashboard-upgrade">
          <CatIllustration variant="nap" />
          <span className="eyebrow">A LITTLE MORE POSSIBILITY</span>
          <strong>More room for big ideas.</strong>
          <p>Premium is on the way. From $4/month, with 20% off yearly.</p>
          <button className="button button-outline button-small" onClick={onPremium}>
            Explore Premium <Sparkles size={14} />
          </button>
        </div>
      </aside>
      <div className="dashboard-content">
        <div className="dashboard-topbar">
          <span>Your dashboard</span>
          <div className="dashboard-user">
            <GuestAvatar guestId={account.id} name={account.name} />
            <div>
              <strong>{account.name}</strong>
              <span>{account.email}</span>
            </div>
            <button className="text-button" onClick={onSignOut}>
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>
        {profilePage ? (
          <ProfilePage account={account} onDeleted={onAccountDeleted} />
        ) : (
          <>
            <header className="dashboard-header">
              <div>
                <span className="eyebrow">YOUR CREATIVE CORNER</span>
                <h1>
                  Hey, {account.name.split(' ')[0]}. <span>Let’s make something.</span>
                </h1>
                <p>Your spaces, your people, and every little idea in between.</p>
              </div>
              <div className="dashboard-header-actions">
                <button className="button button-outline button-small" onClick={onJoin}>
                  <Link size={16} />
                  Join a space
                </button>
                <button className="button button-primary button-small" onClick={onCreate}>
                  <Plus size={16} />
                  Create a space
                </button>
              </div>
            </header>
            <section className="dashboard-stats" aria-label="Account overview">
              <article>
                <Grid2X2 size={19} />
                <div>
                  <strong>{account.createdRoomsCount}</strong>
                  <span>Spaces created</span>
                </div>
              </article>
              <article>
                <Plus size={19} />
                <div>
                  <strong>{account.remainingCreations ?? '∞'}</strong>
                  <span>
                    {account.remainingCreations === null
                      ? 'Unlimited creations'
                      : 'Free creations left'}
                  </span>
                </div>
              </article>
              <article>
                <Users size={19} />
                <div>
                  <strong>{account.maxParticipants ?? '∞'}</strong>
                  <span>People per space</span>
                </div>
              </article>
              <article>
                <Headphones size={19} />
                <div>
                  <strong>{active}</strong>
                  <span>Spaces with people online</span>
                </div>
              </article>
            </section>
            <div className="dashboard-workspace">
              <section className="dashboard-spaces" aria-labelledby="your-spaces-title">
                <div className="dashboard-section-heading">
                  <div>
                    <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
                    <h2 id="your-spaces-title">
                      Your spaces <span>{rooms.length}</span>
                    </h2>
                  </div>
                  <button
                    className="icon-button"
                    onClick={onRetry}
                    disabled={loading}
                    aria-label="Refresh saved spaces"
                  >
                    <RefreshCw size={17} className={loading ? 'spin' : ''} />
                  </button>
                </div>
                <div className="dashboard-filters">
                  <label className="dashboard-search">
                    <Search size={17} />
                    <input
                      type="search"
                      aria-label="Search your spaces"
                      placeholder="Find a space…"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Sort spaces"
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                  >
                    <option value="newest">Newest first</option>
                    <option value="saved">Recently saved</option>
                    <option value="name">Name A–Z</option>
                  </select>
                </div>
                {error ? (
                  <div className="dashboard-empty" role="alert">
                    <p>{error}</p>
                    <button className="button button-outline" onClick={onRetry}>
                      Try again
                    </button>
                  </div>
                ) : loading && !rooms.length ? (
                  <div className="dashboard-empty" role="status">
                    Loading your saved spaces…
                  </div>
                ) : !rooms.length ? (
                  <div className="dashboard-empty">
                    <CatIllustration variant="peek" />
                    <h3>Your next idea starts here.</h3>
                    <p>Create your first space. We’ll keep your whiteboard and chat saved here.</p>
                    <button className="button button-primary" onClick={onCreate}>
                      <Plus size={17} />
                      Create your first space
                    </button>
                  </div>
                ) : !visible.length ? (
                  <div className="dashboard-empty">
                    <Search size={25} />
                    <h3>No spaces found.</h3>
                    <p>Try another name or room code.</p>
                    <button className="text-button" onClick={() => setQuery('')}>
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div className="dashboard-space-grid">
                    {visible.map((room) => (
                      <SpaceCard
                        key={room.roomCode}
                        room={room}
                        onDetails={() => onNavigate(`/dashboard/spaces/${room.roomCode}`)}
                      />
                    ))}
                  </div>
                )}
                {selectedCode && !selected && !loading && !error && (
                  <p className="dashboard-detail-error" role="alert">
                    This space is not in your account.{' '}
                    <button className="text-button" onClick={() => onNavigate('/dashboard')}>
                      Back to your spaces
                    </button>
                  </p>
                )}
              </section>
              {selected && (
                <SpaceDetails
                  room={selected}
                  account={account}
                  onClose={() => onNavigate('/dashboard')}
                  notify={notify}
                  onDeleted={() => {
                    onNavigate('/dashboard');
                    onRetry();
                    notify('Space and all related data deleted.');
                  }}
                />
              )}
            </div>
            {listDrafts().length > 0 && (
              <section className="dashboard-drafts">
                <h2>Private drafts on this browser</h2>
                <p>These don’t use your free limit. Share one to save it to your account.</p>
                <div>
                  {listDrafts().map((draft) => (
                    <a key={draft.id} href={`/draft/${draft.id}`}>
                      <span>{draft.title || 'Untitled space'}</span>
                      <ArrowUpRight size={15} />
                    </a>
                  ))}
                </div>
              </section>
            )}
            <section className="dashboard-profile" id="profile">
              <GuestAvatar guestId={account.id} name={account.name} />
              <div>
                <span className="eyebrow">YOUR SAVED PROFILE</span>
                <h2>{account.name}</h2>
                <p>{account.email}</p>
                <span>This name and cat avatar travel with you to your spaces.</span>
              </div>
              <a className="text-button" href="/dashboard/profile">
                View profile <ArrowUpRight size={14} />
              </a>
              <div className="dashboard-plan">
                <span className="plan-tag">{account.plan === 'PRO' ? 'PREMIUM' : 'FREE PLAN'}</span>
                <p>
                  {account.creationLimit === null
                    ? 'Unlimited space creations'
                    : `${account.createdRoomsCount} of ${account.creationLimit} lifetime creations used`}
                </p>
                <button className="text-button" onClick={onPremium}>
                  See what’s coming <ArrowUpRight size={14} />
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
