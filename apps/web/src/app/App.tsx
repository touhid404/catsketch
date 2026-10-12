import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowRight, LoaderCircle, X } from 'lucide-react';
import type { GuestSession } from '@catsketch/shared';
import AuthPage from '../features/auth/pages/AuthPage';
import { useAccount } from '../features/auth/hooks/useAccount';
import Landing from '../features/landing/pages/LandingPage';
import Dashboard from '../features/dashboard/pages/DashboardPage';
import type { Template } from '../features/landing/types';
import { Brand } from '../components/ui/Brand';
import { NoticeDialog } from '../components/ui/NoticeDialog';
import GuestModal from '../features/rooms/components/GuestDialog';
import { loadGuest, rememberGuest } from '../features/rooms/lib/guest-session';
import {
  createDraft,
  saveDraft,
  forgetPublishedDrafts,
  type Draft,
} from '../features/drafts/lib/draft-storage';
import { request } from '../lib/api-client';
const Room = lazy(() => import('../features/rooms/pages/RoomPage'));
const DraftPage = lazy(() => import('../features/drafts/pages/DraftPage'));
export default function App() {
  const auth = useAccount();
  const [premiumNotice, setPremiumNotice] = useState(false);
  const [location, setLocation] = useState(window.location.pathname + window.location.search);
  const pathname = location.split('?')[0];
  const query = new URLSearchParams(location.split('?')[1]);
  const code = /^\/room\/([\w-]{12})\/?$/.exec(pathname)?.[1];
  const draftId = /^\/draft\/([\da-f-]{36})\/?$/.exec(pathname)?.[1];
  const dashboardPath = /^\/dashboard(?:\/spaces\/([\w-]{12})|\/(profile))?\/?$/.exec(pathname);
  const authMode = pathname === '/login' ? 'login' : pathname === '/signup' ? 'register' : null;
  const returnDraft = /^[\da-f-]{36}$/.test(query.get('draft') || '') ? query.get('draft') : null;
  const [guest, setGuest] = useState<GuestSession | null>(() => (code ? loadGuest(code) : null));
  const [join, setJoin] = useState(false);
  const [toast, setToast] = useState('');
  const publishing = useRef(false);
  const navigate = (path: string) => {
    history.pushState({}, '', path);
    setLocation(path);
    const nextCode = /^\/room\/([\w-]{12})/.exec(path)?.[1];
    setGuest(nextCode ? loadGuest(nextCode) : null);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const pop = () => {
      setLocation(window.location.pathname + window.location.search);
      const nextCode = /^\/room\/([\w-]{12})/.exec(window.location.pathname)?.[1];
      setGuest(nextCode ? loadGuest(nextCode) : null);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    if (dashboardPath) document.title = 'Your dashboard — CatSketch';
  }, [pathname]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const enter = (session: GuestSession, invite = false) => {
    rememberGuest(session);
    void auth.refresh();
    navigate(`/room/${session.room.roomCode}${invite ? '?invite=1' : ''}`);
    setGuest(session);
    setJoin(false);
  };
  const expired = () => {
    if (code) sessionStorage.removeItem(`syncspace:guest:${code}`);
    setGuest(null);
  };
  const signOut = () => {
    void auth
      .signOut()
      .then(() => {
        setJoin(false);
        navigate('/');
      })
      .catch(() => setToast('Could not log out. Try again.'));
  };
  const create = async (template: Template) => {
    try {
      const draft = await createDraft(template);
      navigate(`/draft/${draft.id}`);
    } catch {
      setToast('Browser storage is unavailable. Enable storage to keep a private canvas.');
    }
  };
  const share = async (draft: Draft) => {
    if (!auth.account) {
      navigate(`/login?draft=${draft.id}`);
      return;
    }
    if (draft.publishedCode) {
      navigate(`/room/${draft.publishedCode}?invite=1`);
      return;
    }
    if (publishing.current) return;
    if (auth.account.remainingCreations === 0)
      throw new Error(
        'You’ve used your five free shared spaces. Keep editing privately or open an existing space.',
      );
    publishing.current = true;
    try {
      const session = await request<GuestSession>('/sessions', {
        username: auth.account.name,
        title: draft.title.trim() || 'Untitled space',
        elements: draft.elements,
      });
      try {
        draft.publishedCode = session.room.roomCode;
        saveDraft(draft);
      } catch {
        /* The published board is safely stored on the server. */
      }
      enter(session, true);
    } finally {
      publishing.current = false;
    }
  };
  const loading = (
    <div className="loading-screen">
      <LoaderCircle className="spin" />
      Opening your space…
    </div>
  );
  if (pathname !== '/' && !code && !draftId && !dashboardPath && !authMode)
    return (
      <div className="not-found">
        <Brand />
        <h1>This space is off the map.</h1>
        <p>Check your invitation link, or create a new space.</p>
        <a className="button button-primary" href="/">
          Back to CatSketch <ArrowRight size={18} />
        </a>
      </div>
    );
  return (
    <>
      {authMode ? (
        <AuthPage
          key={authMode}
          initialMode={authMode}
          onNavigate={(mode) =>
            navigate(
              `${mode === 'login' ? '/login' : '/signup'}${returnDraft ? `?draft=${returnDraft}` : ''}`,
            )
          }
          onSuccess={(account) => {
            auth.setAccount(account);
            void auth.refresh();
            navigate(returnDraft ? `/draft/${returnDraft}?share=1` : '/dashboard');
          }}
        />
      ) : draftId ? (
        <Suspense fallback={loading}>
          <DraftPage
            key={draftId}
            id={draftId}
            account={auth.account}
            accountLoading={auth.loading}
            autoShare={query.get('share') === '1'}
            onShare={share}
            notify={setToast}
          />
        </Suspense>
      ) : code && guest ? (
        <Suspense fallback={loading}>
          <Room
            key={code}
            session={guest}
            notify={setToast}
            onExpired={expired}
            account={auth.account}
            initialInvite={query.get('invite') === '1'}
            onDeleted={() => {
              expired();
              navigate(auth.account ? '/dashboard' : '/');
              void auth.refresh();
            }}
          />
        </Suspense>
      ) : dashboardPath ? (
        auth.account ? (
          <Dashboard
            account={auth.account}
            rooms={auth.rooms}
            loading={auth.loading}
            error={auth.error}
            selectedCode={dashboardPath[1]}
            profilePage={!!dashboardPath[2]}
            onNavigate={navigate}
            onCreate={() => create('blank')}
            onJoin={() => setJoin(true)}
            onSignOut={signOut}
            onRetry={auth.refresh}
            onPremium={() => setPremiumNotice(true)}
            notify={setToast}
            onAccountDeleted={() => {
              forgetPublishedDrafts(auth.rooms.map((room) => room.roomCode));
              auth.setAccount(null);
              navigate('/');
            }}
          />
        ) : (
          <div className="dashboard-auth">
            <Brand />
            {auth.loading ? (
              <>
                <LoaderCircle className="spin" />
                <p role="status">Finding your creative corner…</p>
              </>
            ) : (
              <>
                <h1>Your ideas have a home.</h1>
                <p>{auth.error || 'Sign in to see your saved spaces and your profile.'}</p>
                <button className="button button-primary" onClick={() => navigate('/login')}>
                  Sign in to your dashboard <ArrowRight size={17} />
                </button>
                <a className="text-button" href="/">
                  Explore CatSketch
                </a>
              </>
            )}
          </div>
        )
      ) : (
        <Landing
          account={auth.account}
          accountLoading={auth.loading}
          onSignIn={() => navigate('/login')}
          onDashboard={() => navigate('/dashboard')}
          onPremium={() => setPremiumNotice(true)}
          onCreate={create}
          onJoin={() => setJoin(true)}
        />
      )}
      {(join || (code && !guest)) && (
        <GuestModal
          roomCode={code}
          defaultName={auth.account?.name}
          avatarSeed={auth.account?.id}
          onClose={code ? () => navigate(auth.account ? '/dashboard' : '/') : () => setJoin(false)}
          onEnter={enter}
        />
      )}
      {premiumNotice && <NoticeDialog onClose={() => setPremiumNotice(false)} />}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button
            className="icon-button"
            onClick={() => setToast('')}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
