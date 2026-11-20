'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

export interface SessionUser { id: string; email: string; name: string }

interface Ctx {
  user: SessionUser | null;
  loading: boolean;
  setUser: (u: SessionUser | null) => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    api<SessionUser>('/api/auth/session')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    router.push('/auth/login');
  }, [router]);

  return <SessionContext.Provider value={{ user, loading, setUser, logout }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const c = useContext(SessionContext);
  if (!c) throw new Error('useSession must be used within SessionProvider');
  return c;
}

/** For protected pages: redirects to login when signed out. */
export function useRequireUser() {
  const s = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!s.loading && !s.user) router.replace('/auth/login');
  }, [s.loading, s.user, router]);
  return s;
}
