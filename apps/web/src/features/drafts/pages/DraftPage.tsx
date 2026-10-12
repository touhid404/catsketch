import { useEffect, useRef, useState } from 'react';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { Download, Link, LoaderCircle, LockKeyhole } from 'lucide-react';
import type { AccountSummary, SceneElement } from '@catsketch/shared';
import { Brand } from '../../../components/ui/Brand';
import { readDraft, saveDraft, type Draft } from '../lib/draft-storage';
export default function DraftPage({
  id,
  account,
  accountLoading,
  autoShare,
  onShare,
  notify,
}: {
  id: string;
  account: AccountSummary | null;
  accountLoading: boolean;
  autoShare: boolean;
  onShare: (draft: Draft) => Promise<void>;
  notify: (message: string) => void;
}) {
  const [initial] = useState(() => readDraft(id));
  const draft = useRef(initial);
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const [title, setTitle] = useState(initial?.title || 'Untitled space');
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const attempted = useRef(false);
  const persist = () => {
    if (!draft.current) return;
    try {
      saveDraft(draft.current);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  };
  const share = async () => {
    if (!draft.current || busy) return;
    clearTimeout(timer.current);
    persist();
    setBusy(true);
    try {
      await onShare(draft.current);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not share. Your sketch is still here.',
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    document.title = `${title} — Private canvas · CatSketch`;
  }, [title]);
  useEffect(() => {
    const save = () => {
      if (draft.current) {
        try {
          saveDraft(draft.current);
        } catch {}
      }
    };
    window.addEventListener('pagehide', save);
    return () => {
      clearTimeout(timer.current);
      save();
      window.removeEventListener('pagehide', save);
    };
  }, []);
  useEffect(() => {
    if (autoShare && account && !attempted.current) {
      attempted.current = true;
      void share();
    }
  }, [autoShare, account]);
  if (!initial)
    return (
      <div className="dashboard-auth">
        <Brand />
        <h1>This draft isn’t on this browser.</h1>
        <p>
          Private drafts stay in the browser where you started them. Open a shared invitation to
          join with a name.
        </p>
        <a className="button button-primary" href="/">
          Start sketching
        </a>
      </div>
    );
  if (initial.publishedCode)
    return (
      <div className="dashboard-auth">
        <Brand />
        <h1>This canvas is shared.</h1>
        <p>
          Your work is saved to your account. Open the shared space to keep editing with your
          people.
        </p>
        <a className="button button-primary" href={`/room/${initial.publishedCode}`}>
          Open shared space
        </a>
        <a className="text-button" href="/">
          Start a new canvas
        </a>
      </div>
    );
  const exportBoard = async () => {
    if (!api.current) return;
    try {
      const blob = await exportToBlob({
        elements: api.current.getSceneElements(),
        appState: { ...api.current.getAppState(), exportBackground: true },
        files: api.current.getFiles(),
        mimeType: 'image/png',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/[^\w\s-]/g, '') || 'catsketch'}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      notify('Add something to your canvas before exporting.');
    }
  };
  return (
    <div className="workspace private-workspace">
      <header className="workspace-header">
        <Brand small />
        <div className="workspace-divider" />
        <div className="workspace-title draft-title">
          <input
            aria-label="Space name"
            maxLength={80}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              draft.current = {
                ...draft.current!,
                title: event.target.value,
                updatedAt: new Date().toISOString(),
              };
              persist();
            }}
          />
          <span className="connection">
            <LockKeyhole size={11} />
            {saved
              ? 'Private · saved on this browser'
              : 'Browser storage full · export to keep your work'}
          </span>
        </div>
        <div className="workspace-actions">
          {account && (
            <a className="text-button" href="/dashboard">
              Dashboard
            </a>
          )}
          <button
            className="icon-button"
            aria-label="Export whiteboard as PNG"
            onClick={exportBoard}
          >
            <Download size={18} />
          </button>
          <button
            className="button button-primary button-small"
            disabled={busy || accountLoading}
            onClick={share}
          >
            {busy ? <LoaderCircle className="spin" size={15} /> : <Link size={15} />}Share space
          </button>
        </div>
      </header>
      <div className="workspace-body">
        <main className="whiteboard">
          <Excalidraw
            excalidrawAPI={(value) => {
              api.current = value;
            }}
            initialData={{
              elements: initial.elements as never,
              appState: { viewBackgroundColor: '#fbfbf9', gridSize: 20 },
            }}
            onChange={(elements) => {
              draft.current = {
                ...draft.current!,
                elements: elements as unknown as SceneElement[],
                updatedAt: new Date().toISOString(),
              };
              clearTimeout(timer.current);
              timer.current = setTimeout(persist, 300);
            }}
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
                notify('Use drawings and text. Image uploads are not available yet.');
                return false;
              }
              return true;
            }}
          />
        </main>
      </div>
      <footer className="workspace-footer">
        <span>
          <LockKeyhole size={12} /> Private canvas
        </span>
        <span>
          {account
            ? 'Share to save to your account and invite your people.'
            : 'Sketch freely. Sign in only when you’re ready to share.'}
        </span>
        <span>No account needed to edit</span>
      </footer>
    </div>
  );
}
