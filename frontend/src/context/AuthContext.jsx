import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

/**
 * AuthContext — God-tier auth state management.
 *
 * Provides:
 * - Reactive user state (auto-syncs with Supabase auth)
 * - Login/logout methods
 * - Guest mode detection
 * - Display name/avatar resolution
 * - Guest-to-user migration (guest data persists after sign-in)
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Auto-sync with Supabase auth state ──────────────────
  useEffect(() => {
    // Initial check
    supabase?.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser(data.user);
        _migrateGuestData(data.user);
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    // Listen for auth changes (login, logout, token refresh)
    const { data: listener } = supabase?.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user || null;
      setUser(newUser);

      if (newUser) {
        _migrateGuestData(newUser);
        sessionStorage.removeItem('isGuest');
      }
    }) || { data: null };

    return () => listener?.subscription?.unsubscribe();
  }, []);

  // ── Guest-to-User Migration ─────────────────────────────
  // When a guest signs in, transfer their sessionStorage data
  // to the authenticated session so progress isn't lost.
  function _migrateGuestData(authenticatedUser) {
    const wasGuest = sessionStorage.getItem('isGuest') === 'true';
    if (!wasGuest) return;

    console.log('[Auth] Migrating guest data to authenticated session...');

    // Transfer username preference
    const guestName = sessionStorage.getItem('username');
    if (guestName && !guestName.includes('@')) {
      sessionStorage.setItem('username',
        authenticatedUser.user_metadata?.full_name || guestName
      );
    }

    sessionStorage.removeItem('isGuest');
  }

  // ── Actions ─────────────────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return { error: new Error('Auth not configured. Check SUPABASE env vars.') };
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/home` },
    });
  }, []);

  const signOut = useCallback(async () => {
    sessionStorage.clear();
    await supabase?.auth.signOut();
    setUser(null);
  }, []);

  // ── Derived State ───────────────────────────────────────
  const isGuest = !user && sessionStorage.getItem('isGuest') === 'true';
  const isAuthenticated = !!user;

  const displayName = user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || sessionStorage.getItem('username')
    || 'Scholar';

  const avatar = user?.user_metadata?.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=f2ca50&color=3c2f00&size=128`;

  const userId = user?.id || null;
  const email = user?.email || null;

  return (
    <AuthContext.Provider value={{
      // State
      user, loading, isGuest, isAuthenticated,
      displayName, avatar, userId, email,
      // Actions
      signInWithGoogle, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
