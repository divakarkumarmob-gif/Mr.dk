import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';

/**
 * AuthContext
 * -----------
 * Makes the current user available to any component in the tree via
 * useAuth(), without needing to pass `user` down as a prop through every
 * level. This is what lets top-level routes (mounted outside AppInner,
 * e.g. /notes-library, /edit-profile) read the logged-in user directly.
 *
 * IMPORTANT: This does NOT replace the existing auth logic in App.tsx
 * (Firebase onAuthStateChanged listener, guest-user localStorage fallback,
 * guest subjects initialization, etc). That logic is complex and already
 * works, so it stays exactly where it is inside AppInner. AppInner simply
 * calls setAuthUser(...) whenever its own `user` state changes, so this
 * context is kept in sync as a mirror of the source of truth.
 *
 * Future direction (not done yet, to avoid a risky big-bang refactor):
 * the Firebase listener + guest-user logic could eventually move into
 * AuthProvider itself, at which point AppInner would just read useAuth()
 * instead of managing its own `user` state.
 */

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** Internal: called by AppInner to keep this context in sync. */
  _setAuthUser: (user: User | null) => void;
  _setAuthLoading: (loading: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        _setAuthUser: setUser,
        _setAuthLoading: setLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth
 * -------
 * Use this in any route/component that needs to know who's logged in,
 * e.g.:
 *   const { user } = useAuth();
 *   if (!user) return <Navigate to="/" />;
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
