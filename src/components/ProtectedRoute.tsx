import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProtectedRoute
 * --------------
 * Wrap any route element that should only be reachable when a user is
 * logged in, e.g.:
 *
 *   <Route path="/notes-library" element={
 *     <ProtectedRoute><NotesLibraryRoute /></ProtectedRoute>
 *   } />
 *
 * This is the pattern most apps use: routes declare their own auth
 * requirement instead of every screen re-checking `!user` manually.
 *
 * While auth state is still loading (Firebase hasn't responded yet),
 * this renders nothing rather than redirecting, so a logged-in user
 * refreshing the page doesn't get bounced to "/" before Firebase has
 * had a chance to restore their session.
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="fixed inset-0 bg-[#0a0f24] text-white flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
