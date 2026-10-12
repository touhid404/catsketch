import { useEffect, useState } from 'react';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import type { AccountSummary } from '@catsketch/shared';
import { Brand } from '../../../components/ui/Brand';
import { CatIllustration } from '../../avatars/components/CatIllustration';
import '../styles/auth.css';
import { request } from '../../../lib/api-client';
export default function AuthPage({
  onNavigate,
  onSuccess,
  initialMode = 'register',
}: {
  onNavigate: (mode: 'login' | 'register') => void;
  onSuccess: (account: AccountSummary) => void;
  initialMode?: 'login' | 'register';
}) {
  const mode = initialMode;
  useEffect(() => {
    document.title = `${mode === 'login' ? 'Sign in' : 'Sign up'} — CatSketch`;
  }, [mode]);
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSuccess(
        await request<AccountSummary>(`/auth/${mode}`, {
          email,
          password,
          ...(mode === 'register' ? { name } : {}),
        }),
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not sign in. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-page">
      <div className="auth-art">
        <Brand />
        <div>
          <span className="eyebrow">ROOM FOR YOUR NEXT BIG IDEA</span>
          <h1>
            A little sketch.
            <br />A lot of possibility.
          </h1>
          <p>
            Start a private canvas freely. Sign in to save a shared space and bring your people
            together.
          </p>
          <CatIllustration variant={mode === 'login' ? 'peek' : 'play'} />
          <span className="auth-art-note">Your ideas deserve good company.</span>
        </div>
        <a href="/" className="text-button">
          ← Back to CatSketch
        </a>
      </div>
      <section className="guest-modal auth-form" aria-labelledby="auth-title">
        <div className="auth-mobile-cat">
          <CatIllustration variant={mode === 'login' ? 'peek' : 'play'} />
        </div>
        <div className="eyebrow">A HOME FOR YOUR IDEAS</div>
        <h2 id="auth-title">{mode === 'register' ? 'Make yourself at home.' : 'Welcome back.'}</h2>
        <p>
          {mode === 'register'
            ? 'Create an account to save your spaces. Your guests can join with just a name.'
            : 'Your people and your ideas are waiting.'}
        </p>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label htmlFor="account-name">Your name</label>
              <input
                id="account-name"
                autoFocus
                autoComplete="name"
                maxLength={32}
                required
                disabled={busy}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </>
          )}
          <label htmlFor="account-email">Email</label>
          <input
            id="account-email"
            type="email"
            autoFocus={mode === 'login'}
            autoComplete="email"
            required
            maxLength={254}
            disabled={busy}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="account-password">Password</label>
          <input
            id="account-password"
            type="password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={mode === 'register' ? 12 : 1}
            maxLength={128}
            required
            disabled={busy}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === 'register' && (
            <span className="auth-password-hint">
              At least 12 characters. A memorable phrase works well.
            </span>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}
            {busy ? 'One moment…' : mode === 'register' ? 'Create my account' : 'Sign in'}
          </button>
        </form>
        <button
          className="auth-switch"
          disabled={busy}
          onClick={() => {
            onNavigate(mode === 'login' ? 'register' : 'login');
            setPassword('');
            setError('');
          }}
        >
          {mode === 'register'
            ? 'Already have an account? Sign in'
            : 'New here? Create a free account'}
        </button>
        <div className="modal-footnote">
          Five shared spaces. Ten people per space. No card needed.
        </div>
      </section>
    </main>
  );
}
