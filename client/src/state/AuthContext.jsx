import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

const DEMO_KEY = 'rollbound:demo';

function readDemoFlag() {
  try {
    return sessionStorage.getItem(DEMO_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDemoFlag(on) {
  try {
    if (on) sessionStorage.setItem(DEMO_KEY, '1');
    else sessionStorage.removeItem(DEMO_KEY);
  } catch {
    // Storage blocked: demo still works, it just won't survive a refresh.
  }
}

/** status is 'loading' | 'signedOut' | 'user' | 'demo'. */
export function AuthProvider({ children }) {
  const [status, setStatus] = useState(() => (readDemoFlag() ? 'demo' : 'loading'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (status !== 'loading') return;
    let cancelled = false;
    api
      .me()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setStatus('user');
      })
      .catch(() => !cancelled && setStatus('signedOut'));
    return () => {
      cancelled = true;
    };
  }, [status]);

  const signIn = useCallback((u) => {
    writeDemoFlag(false);
    setUser(u);
    setStatus('user');
  }, []);

  const login = useCallback(async (email, password) => signIn(await api.login(email, password)), [signIn]);

  const register = useCallback(
    async (displayName, email, password) => signIn(await api.register(displayName, email, password)),
    [signIn],
  );

  const enterDemo = useCallback(() => {
    writeDemoFlag(true);
    setUser(null);
    setStatus('demo');
  }, []);

  const logout = useCallback(async () => {
    if (status === 'user') await api.logout().catch(() => {});
    writeDemoFlag(false);
    setUser(null);
    setStatus('signedOut');
  }, [status]);

  const value = useMemo(
    () => ({ status, user, isDemo: status === 'demo', login, register, enterDemo, logout }),
    [status, user, login, register, enterDemo, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
