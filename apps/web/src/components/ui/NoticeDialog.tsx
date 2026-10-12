import { useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
import { CatIllustration } from '../../features/avatars/components/CatIllustration';
export function NoticeDialog({ onClose }: { onClose: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    button.current?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const buttons = button.current
          ?.closest('section')
          ?.querySelectorAll<HTMLButtonElement>('button');
        if (buttons?.length) {
          event.preventDefault();
          const index = [...buttons].indexOf(document.activeElement as HTMLButtonElement);
          buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus();
        }
      }
    };
    window.addEventListener('keydown', keys);
    return () => {
      window.removeEventListener('keydown', keys);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="guest-modal premium-notice"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="premium-title"
        aria-describedby="premium-description"
      >
        <button
          className="modal-close icon-button"
          onClick={onClose}
          aria-label="Close Premium notice"
        >
          <X size={20} />
        </button>
        <CatIllustration variant="play" />
        <div className="eyebrow">
          <Sparkles size={14} /> SOMETHING GOOD IS ON THE WAY
        </div>
        <h2 id="premium-title">Premium is coming soon.</h2>
        <p id="premium-description">
          A little more room for your biggest ideas. Payments and upgrades will be available later.
        </p>
        <div className="notice-pricing">
          Planned pricing: $4/month or $38.40/year.
          <span>Save 20% with yearly billing. No payment today.</span>
        </div>
        <button ref={button} className="button button-primary" onClick={onClose}>
          Got it. Back to sketching.
        </button>
      </section>
    </div>
  );
}
