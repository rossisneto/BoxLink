import { StrictMode, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import TvScreen from './App.tsx';
import './index.css';

type SessionRole = 'pending' | 'approved' | 'admin' | 'coach';

interface SessionData {
  userId?: string;
  role?: SessionRole;
  token?: string;
  refreshToken?: string;
  expiresAt?: number;
}

interface SupabaseAuthSuccess {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user?: {
    id?: string;
    email_confirmed_at?: string | null;
  };
}

const SESSION_STORAGE_KEYS = ['boxlink_session', 'session'];
const SUPABASE_SESSION_KEY = 'boxlink_session';
const LEGACY_SESSION_KEY = 'session';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function readSession(): SessionData | null {
  for (const key of SESSION_STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as SessionData;
      if (parsed && typeof parsed === 'object' && parsed.token) {
        if (parsed.expiresAt && Date.now() > parsed.expiresAt * 1000) {
          localStorage.removeItem(key);
          continue;
        }
        return parsed;
      }
    } catch {
      // Ignore invalid session payloads and continue searching.
    }
  }

  return null;
}

function persistSession(session: SessionData) {
  localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(session));
  if (localStorage.getItem(LEGACY_SESSION_KEY)) {
    localStorage.removeItem(LEGACY_SESSION_KEY);
  }
}

function clearSession() {
  localStorage.removeItem(SUPABASE_SESSION_KEY);
  localStorage.removeItem(LEGACY_SESSION_KEY);
}

function navigate(path: string) {
  if (window.location.pathname === path) {
    return;
  }

  window.history.replaceState(null, '', path);
}

function getFriendlyAuthError(errorMessage: string) {
  const normalized = errorMessage.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'E-mail ou senha inválidos.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.';
  }

  if (normalized.includes('email logins are disabled')) {
    return 'Login com e-mail está desabilitado no momento. Fale com o suporte.';
  }

  if (normalized.includes('jwt expired') || normalized.includes('session')) {
    return 'Sua sessão expirou. Faça login novamente.';
  }

  return 'Não foi possível entrar agora. Tente novamente em instantes.';
}

async function authenticateWithSupabase(email: string, password: string): Promise<SessionData> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configuração do Supabase ausente. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = (await response.json()) as SupabaseAuthSuccess & { error_description?: string; msg?: string };

  if (!response.ok || !payload.access_token) {
    const message = payload.error_description || payload.msg || 'Erro de autenticação.';
    throw new Error(message);
  }

  return {
    userId: payload.user?.id,
    role: 'approved',
    token: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + payload.expires_in,
  };
}

function LoginPage({ onLogin }: { onLogin: (session: SessionData) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const session = await authenticateWithSupabase(email, password);
      persistSession(session);
      onLogin(session);
      navigate('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao autenticar.';
      setError(getFriendlyAuthError(message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-on-surface flex items-center justify-center p-4 sm:p-8">
      <section className="max-w-md w-full bg-surface-container rounded-2xl p-6 sm:p-8 space-y-4">
        <h1 className="text-3xl font-headline font-bold text-center">BoxLink Login</h1>
        <p className="text-on-surface-variant text-center">Sem sessão ativa: faça login para continuar.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="E-mail"
            autoComplete="email"
            required
            className="w-full rounded-xl bg-background border border-white/10 px-4 py-3"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Senha"
            autoComplete="current-password"
            required
            className="w-full rounded-xl bg-background border border-white/10 px-4 py-3"
          />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl py-3 font-headline font-bold bg-primary-container text-on-primary-fixed disabled:opacity-60"
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
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
  const [session, setSession] = useState<SessionData | null>(() => readSession());
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocation = () => {
      setPathname(window.location.pathname);
      setSession(readSession());
    };

    window.addEventListener('popstate', handleLocation);
    window.addEventListener('focus', handleLocation);

    return () => {
      window.removeEventListener('popstate', handleLocation);
      window.removeEventListener('focus', handleLocation);
    };
  }, []);

  useEffect(() => {
    if (pathname === '/') {
      navigate(session ? '/dashboard' : '/login');
      setPathname(window.location.pathname);
      return;
    }

    if (!session && pathname !== '/login' && pathname !== '/tv') {
      clearSession();
      navigate('/login');
      setPathname('/login');
      return;
    }

    if (session && pathname === '/login') {
      navigate('/dashboard');
      setPathname('/dashboard');
    }
  }, [pathname, session]);

  const route = useMemo(() => window.location.pathname, [pathname]);

  if (route === '/tv') {
    return <TvScreen />;
  }

  if (route === '/dashboard' || route === '/home' || route === '/admin' || route === '/coach') {
    return <DashboardPage role={session?.role} />;
  }

  return <LoginPage onLogin={setSession} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterApp />
  </StrictMode>,
);
