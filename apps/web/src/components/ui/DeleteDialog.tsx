import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Trash2, X } from 'lucide-react';
export function DeleteDialog({
  title,
  description,
  passwordRequired = false,
  onDelete,
  onClose,
}: {
  title: string;
  description: string;
  passwordRequired?: boolean;
  onDelete: (password: string) => Promise<void>;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>('button')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key !== 'Tab') return;
      const items = [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled)',
        ) || []),
      ];
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [busy, onClose]);
  return (
    <div className="modal-backdrop">
      <section
        ref={dialog}
        className="guest-modal delete-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-description"
      >
        <button
          className="icon-button modal-close"
          aria-label="Cancel deletion"
          onClick={onClose}
          disabled={busy}
        >
          <X size={20} />
        </button>
        <div className="modal-symbol">
          <Trash2 size={24} />
        </div>
        <h2 id="delete-title">{title}</h2>
        <p id="delete-description">{description}</p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            try {
              await onDelete(password);
            } catch (error) {
              setError(error instanceof Error ? error.message : 'Could not delete. Try again.');
              setBusy(false);
            }
          }}
        >
          {passwordRequired && (
            <>
              <label htmlFor="delete-password">Confirm your current password</label>
              <input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={busy}
              />
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-danger" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}{' '}
            {busy ? 'Deleting…' : 'Permanently delete'}
          </button>
        </form>
        <button className="text-button delete-cancel" disabled={busy} onClick={onClose}>
          Keep it and go back
        </button>
      </section>
    </div>
  );
}
