import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SIGNED_OUT_EVENT, api } from '../api.js';
import { applyTheme } from '../themes.js';

const AuthContext = createContext(null);

// Remembers whether this browser was last signed in to a demo or an account, so a
// visit after it ended can say why you're signed out. Cleared on signing out.
const LAST_SESSION_KEY = 'rollbound.lastSession';
const remember = (kind) => {
  try {
    if (kind) localStorage.setItem(LAST_SESSION_KEY, kind);
    else localStorage.removeItem(LAST_SESSION_KEY);
  } catch {
    // Storage blocked: the note just won't show.
  }
};
const lastSession = () => {
  try {
    return localStorage.getItem(LAST_SESSION_KEY);
  } catch {
    return null;
  }
};

/**
 * status is 'loading' | 'signedOut' | 'user'. A demo is a real, temporary account
 * on the server (user.isDemo), so it signs in like any other. endedReason says why
 * a session ended without signing out: 'demo' or 'expired' (shown on sign-in).
 */
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  // Signed in, the account's theme wins (it follows them across devices); signed out, the
  // page keeps whatever this device last used (set in index.html before React loads).
  useEffect(() => {
    if (user?.theme) applyTheme(user.theme);
  }, [user?.theme]);
  const [endedReason, setEndedReason] = useState(null);

  // The server stopped recognizing us mid-session: back to sign-in, saying why.
  useEffect(() => {
    if (status !== 'user') return undefined;
    const ended = () => {
      setEndedReason(user?.isDemo ? 'demo' : 'expired');
      remember(null);
      setUser(null);
      setStatus('signedOut');
    };
    window.addEventListener(SIGNED_OUT_EVENT, ended);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, ended);
  }, [status, user]);

  useEffect(() => {
    if (status !== 'loading') return;
    let cancelled = false;
    api
      .me()
      .then((u) => {
        if (cancelled) return;
        remember(u.isDemo ? 'demo' : 'user');
        setUser(u);
        setStatus('user');
      })
      .catch(() => {
        if (cancelled) return;
        // Signed out without signing out: the demo ended or the sign-in expired while away.
        const last = lastSession();
        if (last) setEndedReason(last === 'demo' ? 'demo' : 'expired');
        remember(null);
        setStatus('signedOut');
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  const signIn = useCallback((u) => {
    remember(u.isDemo ? 'demo' : 'user');
    setEndedReason(null);
    setUser(u);
    setStatus('user');
  }, []);

  const login = useCallback(async (email, password) => signIn(await api.login(email, password)), [signIn]);

  const register = useCallback(
    async (displayName, email, password) => signIn(await api.register(displayName, email, password)),
    [signIn],
  );

  const enterDemo = useCallback(async () => signIn(await api.startDemo()), [signIn]);
  // A password reset signs you in with the new password.
  const resetPassword = useCallback(async (token, password) => signIn(await api.resetPassword(token, password)), [signIn]);

  // Signing out of a demo deletes it on the server.
  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    remember(null);
    setEndedReason(null);
    setUser(null);
    setStatus('signedOut');
  }, []);

  const updateProfile = useCallback(async (changes) => setUser(await api.updateProfile(changes)), []);

  const value = useMemo(
    () => ({ status, user, isDemo: Boolean(user?.isDemo), endedReason, login, register, enterDemo, resetPassword, logout, updateProfile }),
    [status, user, endedReason, login, register, enterDemo, resetPassword, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
