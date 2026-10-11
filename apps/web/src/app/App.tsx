import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowRight, LoaderCircle, X } from 'lucide-react';
import type { GuestSession } from '@syncspace/shared';
import Landing from '../features/landing/pages/LandingPage';
import type { Template } from '../features/landing/types';
import { Brand } from '../components/ui/Brand';
import GuestModal from '../features/rooms/components/GuestDialog';
import { loadGuest, rememberGuest } from '../features/rooms/lib/guest-session';
const Room = lazy(() => import('../features/rooms/pages/RoomPage'));
export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const code = /^\/room\/([\w-]{12})\/?$/.exec(pathname)?.[1];
  const [guest, setGuest] = useState<GuestSession | null>(() => (code ? loadGuest(code) : null));
  const [modal, setModal] = useState<'create' | 'join' | null>(null);
  const [template, setTemplate] = useState<Template>('blank');
  const [toast, setToast] = useState('');
  useEffect(() => {
    const pop = () => {
      const next = window.location.pathname;
      setPathname(next);
      const nextCode = /^\/room\/([\w-]{12})\/?$/.exec(next)?.[1];
      setGuest(nextCode ? loadGuest(nextCode) : null);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const enter = (session: GuestSession) => {
    rememberGuest(session);
    setGuest(session);
    setModal(null);
    history.pushState({}, '', `/room/${session.room.roomCode}`);
    setPathname(window.location.pathname);
  };
  const expired = () => {
    if (code) sessionStorage.removeItem(`syncspace:guest:${code}`);
    setGuest(null);
  };
  if (pathname !== '/' && !code)
    return (
      <div className="not-found">
        <Brand />
        <h1>This space is off the map.</h1>
        <p>Check your invitation link, or create a new space.</p>
        <a className="button button-primary" href="/">
          Back to SyncSpace <ArrowRight size={18} />
        </a>
      </div>
    );
  return (
    <>
      {code && guest ? (
        <Suspense
          fallback={
            <div className="loading-screen">
              <LoaderCircle className="spin" /> Opening your space…
            </div>
          }
        >
          <Room session={guest} notify={setToast} onExpired={expired} />
        </Suspense>
      ) : (
        <Landing
          onCreate={(value) => {
            setTemplate(value);
            setModal('create');
          }}
          onJoin={() => setModal('join')}
        />
      )}
      {(modal || (code && !guest)) && (
        <GuestModal
          kind={code ? 'join' : modal!}
          roomCode={code}
          template={template}
          onClose={
            code
              ? () => {
                  history.pushState({}, '', '/');
                  setPathname('/');
                }
              : () => setModal(null)
          }
          onEnter={enter}
        />
      )}
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
