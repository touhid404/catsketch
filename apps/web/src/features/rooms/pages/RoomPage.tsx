import { useEffect, useRef, useState } from 'react';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Copy,
  Download,
  Link,
  LoaderCircle,
  LogOut,
  MessageCircle,
  PanelRightClose,
  PanelRightOpen,
  Send,
  Users,
  Video,
  X,
} from 'lucide-react';
import type { GuestSession } from '@syncspace/shared';
import { GuestAvatar } from '../../avatars/components/GuestAvatar';
import AudioCallPanel from '../../calls/components/AudioCallPanel';
import PeoplePanel from '../components/PeoplePanel';
import ChatPanel from '../components/ChatPanel';
import { Brand } from '../../../components/ui/Brand';
import { request } from '../../../lib/api-client';
import { useCollaboration } from '../hooks/useCollaboration';
export default function Room({
  session,
  notify,
  onExpired,
}: {
  session: GuestSession;
  notify: (message: string) => void;
  onExpired: () => void;
}) {
  const board = useCollaboration(session, notify, onExpired);
  const [sidebar, setSidebar] = useState(() => window.innerWidth > 760);
  const [tab, setTab] = useState<'people' | 'chat'>('people');
  const [invite, setInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const inviteInput = useRef<HTMLInputElement>(null);
  const [unread, setUnread] = useState(0);
  const previousCount = useRef(0);
  const room = session.room;
  const inviteURL = `${window.location.origin}/room/${room.roomCode}`;
  useEffect(() => {
    if (tab === 'chat' && sidebar) {
      setUnread(0);
    } else if (board.messages.length > previousCount.current)
      setUnread((value) => value + board.messages.length - previousCount.current);
    previousCount.current = board.messages.length;
  }, [board.messages, tab, sidebar]);
  useEffect(() => {
    document.title = `${room.title} — SyncSpace`;
    return () => {
      document.title = 'SyncSpace — Room for your next big idea';
    };
  }, [room.title]);
  useEffect(() => {
    if (!invite) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInvite(false);
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [invite]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteURL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      inviteInput.current?.select();
      notify('Select the invitation link and copy it to share.');
    }
  };
  const leave = async () => {
    setLeaving(true);
    try {
      await request(`/sessions/${room.roomCode}/leave`, {}, session.token);
    } catch {
      /* Disconnect still removes online presence. */
    }
    sessionStorage.removeItem(`syncspace:guest:${room.roomCode}`);
    window.location.assign('/');
  };
  const exportBoard = async () => {
    if (!board.api) return;
    try {
      const blob = await exportToBlob({
        elements: board.api.getSceneElements(),
        appState: { ...board.api.getAppState(), exportBackground: true },
        files: board.api.getFiles(),
        mimeType: 'image/png',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${room.title.replace(/[^\w\s-]/g, '').trim() || 'syncspace'}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Your whiteboard is ready to keep.');
    } catch {
      notify('Add something to your board before exporting.');
    }
  };
  return (
    <div className="workspace">
      <header className="workspace-header">
        <Brand small />
        <div className="workspace-divider" />
        <div className="workspace-title">
          <strong>{room.title}</strong>
          <span className={`connection connection-${board.status}`}>
            <i />
            {board.status === 'live'
              ? 'Live · changes synced'
              : board.status === 'offline'
                ? 'Offline · reconnecting'
                : 'Connecting to your space…'}
          </span>
        </div>
        <div className="workspace-actions">
          <div className="participant-stack">
            {board.participants.slice(0, 3).map((p) => (
              <GuestAvatar key={p.guestId} guestId={p.guestId} name={p.username} />
            ))}
            {board.participants.length > 3 && (
              <span className="overflow-avatar">+{board.participants.length - 3}</span>
            )}
          </div>
          <button
            className="icon-button export-button"
            onClick={exportBoard}
            title="Export whiteboard as PNG"
            aria-label="Export whiteboard as PNG"
          >
            <Download size={19} />
          </button>
          <button
            className="button button-outline button-small invite-button"
            onClick={() => setInvite(true)}
          >
            <Link size={15} /> Invite people
          </button>
          <button
            className="icon-button sidebar-toggle"
            onClick={() => setSidebar(!sidebar)}
            aria-label={sidebar ? 'Hide people and chat' : 'Show people and chat'}
          >
            {sidebar ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
          </button>
        </div>
      </header>
      <div className="workspace-body">
        <main className="whiteboard">
          <Excalidraw
            excalidrawAPI={board.setApi}
            onChange={board.onChange}
            onPointerUpdate={board.onPointerUpdate}
            isCollaborating
            initialData={{ appState: { viewBackgroundColor: '#fbfbf9', gridSize: 20 } }}
            UIOptions={{
              canvasActions: {
                loadScene: false,
                saveToActiveFile: false,
                export: false,
                toggleTheme: false,
              },
              tools: { image: false },
            }}
            onPaste={(data) => {
              if (data.files?.length) {
                notify(
                  'This board supports drawings and text. Image uploads are not available yet.',
                );
                return false;
              }
              return true;
            }}
          >
            <div />
          </Excalidraw>
          {board.status !== 'live' && (
            <div className="board-connection-banner" role="status">
              <LoaderCircle className="spin" size={14} />
              {board.status === 'offline'
                ? 'Working offline. Your edits will sync when you reconnect.'
                : 'Opening the shared whiteboard…'}
            </div>
          )}
        </main>
        <aside hidden={!sidebar} className="workspace-sidebar" aria-label="Meeting sidebar">
          <div className="sidebar-heading">
            <div>
              <span className="eyebrow">BETTER TOGETHER</span>
              <h2>Your people, your space.</h2>
            </div>
            <button
              className="icon-button mobile-close-sidebar"
              aria-label="Hide sidebar"
              onClick={() => setSidebar(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="call-section">
            <AudioCallPanel session={session} connected={board.status === 'live'} notify={notify} />
          </div>
          <div className="sidebar-tabs" role="tablist" aria-label="Room details">
            <button
              role="tab"
              aria-selected={tab === 'people'}
              onClick={() => setTab('people')}
              className={tab === 'people' ? 'active' : ''}
            >
              <Users size={16} /> People <span>{board.participants.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={tab === 'chat'}
              onClick={() => setTab('chat')}
              className={tab === 'chat' ? 'active' : ''}
            >
              <MessageCircle size={16} /> Chat {unread > 0 && <span>{unread}</span>}
            </button>
          </div>
          {tab === 'people' ? (
            <PeoplePanel
              participants={board.participants}
              guestId={session.guest.guestId}
              onInvite={() => setInvite(true)}
            />
          ) : (
            <ChatPanel
              messages={board.messages}
              guestId={session.guest.guestId}
              connected={board.status === 'live'}
              onSend={board.sendMessage}
              notify={notify}
            />
          )}
          <div className="sidebar-footer">
            <span>
              Space closes{' '}
              {new Date(room.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
            <button onClick={leave} disabled={leaving}>
              <LogOut size={14} /> {leaving ? 'Leaving…' : 'Leave space'}
            </button>
          </div>
        </aside>
      </div>
      <footer className="workspace-footer">
        <span>
          <span className="live-dot" /> {board.participants.length}{' '}
          {board.participants.length === 1 ? 'person' : 'people'} in this space
        </span>
        <span>
          Sketch a thought. Start a conversation. <span className="footer-spark">✳</span>
        </span>
        <span>{board.status === 'live' ? `Revision ${board.revision}` : 'Reconnecting…'}</span>
      </footer>
      {invite && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInvite(false);
          }}
        >
          <section
            className="guest-modal invite-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
          >
            <button
              className="modal-close icon-button"
              onClick={() => setInvite(false)}
              aria-label="Close invitation"
            >
              <X size={20} />
            </button>
            <div className="modal-symbol">↗</div>
            <div className="eyebrow">GOOD COMPANY. GOOD IDEAS.</div>
            <h2 id="invite-title">Bring your people.</h2>
            <p>
              Anyone with this link can join your space.
              <br />
              All they need is a name.
            </p>
            <label htmlFor="share-link">Your invitation link</label>
            <div className="invite-link-field">
              <input
                id="share-link"
                ref={inviteInput}
                readOnly
                autoFocus
                value={inviteURL}
                onFocus={(e) => e.target.select()}
              />
              <button className="icon-button" onClick={copy} aria-label="Copy invitation link">
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <button className="button button-primary" onClick={copy}>
              {copied ? (
                <>
                  <Check size={18} /> Link copied
                </>
              ) : (
                <>
                  <Link size={18} /> Copy invitation link
                </>
              )}
            </button>
            <div className="modal-footnote">This space is designed for a small team of 3–5.</div>
          </section>
        </div>
      )}
    </div>
  );
}
