import { FormEvent, StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import TvScreen from './App.tsx';
import './index.css';

type SessionRole = 'pending' | 'approved' | 'admin' | 'coach';

interface SessionData {
  userId?: string;
  role?: SessionRole;
  token?: string;
}

const SESSION_STORAGE_KEYS = ['boxlink_session', 'session'];

function readSession(): SessionData | null {
  for (const key of SESSION_STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as SessionData;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // Ignore invalid session payloads and continue searching.
    }
  }

  return null;
}

function navigate(path: string) {
  if (window.location.pathname === path) {
    return;
  }

  window.history.replaceState(null, '', path);
}

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const sessionPayload: SessionData = {
      userId: email || 'user',
      role: 'approved',
      token: 'local-session',
    };

    localStorage.setItem('boxlink_session', JSON.stringify(sessionPayload));
    window.location.replace('/dashboard');
  };

  return (
    <main className="min-h-screen bg-background text-on-surface flex items-center justify-center p-8">
      <section className="max-w-md w-full bg-surface-container rounded-2xl p-6 sm:p-8 space-y-5">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-headline font-bold">BoxLink Login</h1>
          <p className="text-on-surface-variant">Sem sessão ativa: faça login para continuar.</p>
        </header>

        <form className="space-y-4" onSubmit={handleLogin}>
          <label className="block space-y-2">
            <span className="text-sm text-on-surface-variant">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-xl bg-surface-container-highest border border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-primary text-on-surface"
              placeholder="voce@boxlink.com"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-on-surface-variant">Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-xl bg-surface-container-highest border border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-primary text-on-surface"
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-xl bg-primary text-background font-headline font-bold py-3 hover:opacity-90 transition-opacity"
          >
            Entrar
          </button>
        </form>

        <button
          type="button"
          className="w-full rounded-xl border border-white/15 text-on-surface font-headline font-semibold py-3 hover:bg-white/5 transition-colors"
        >
          Criar cadastro
        </button>
      </section>
    </main>
  );
}

function DashboardPage({ role }: { role?: SessionRole }) {
  return (
    <main className="min-h-screen bg-background text-on-surface flex items-center justify-center p-8">
      <section className="max-w-lg w-full bg-surface-container rounded-2xl p-8 text-center space-y-3">
        <h1 className="text-3xl font-headline font-bold">Dashboard / Home</h1>
        <p className="text-on-surface-variant">Sessão ativa detectada ({role ?? 'approved'}).</p>
      </section>
    </main>
  );
}

function RouterApp() {
  const session = useMemo(() => readSession(), []);
  const pathname = window.location.pathname;

  if (pathname === '/') {
    navigate(session ? '/dashboard' : '/login');
  }

  if (!session && pathname !== '/login') {
    navigate('/login');
  }

  if (session && pathname === '/login') {
    navigate('/dashboard');
  }

  const route = window.location.pathname;

  if (route === '/tv') {
    return <TvScreen />;
  }

  if (route === '/dashboard' || route === '/home' || route === '/admin' || route === '/coach') {
    return <DashboardPage role={session?.role} />;
  }

  return <LoginPage />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterApp />
  </StrictMode>,
);
