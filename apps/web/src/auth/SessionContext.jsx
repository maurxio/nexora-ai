import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, clearSession, setTokens } from '../api/client.js';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    const restore = async () => {
      if (localStorage.getItem('nexora_refresh')) {
        try {
          const tokens = await authApi.refresh();
          setTokens(tokens.accessToken, tokens.refreshToken);
          const currentUser = await authApi.me();
          if (!cancelado) setUser(currentUser);
        } catch {
          clearSession();
        }
      }
      if (!cancelado) setLoading(false);
    };
    restore();
    return () => { cancelado = true; };
  }, []);

  const signIn = (data) => {
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  };
  const signOut = async () => {
    try { await authApi.logout(); } finally { clearSession(); setUser(null); }
  };

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
