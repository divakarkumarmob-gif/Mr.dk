import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useNavigate } from 'react-router-dom';

/**
 * useRouteBackButton
 * -------------------
 * AppInner (the legacy currentView-based screen) has its own Capacitor
 * hardware-back-button listener. That listener only exists while AppInner
 * is mounted — but AppInner is NOT mounted while the user is on one of the
 * newer React-Router routes (e.g. /edit-profile, /notes-library,
 * /about, /contact, /school-search), since those are matched by separate
 * <Route> entries and AppInner only mounts for path="*".
 *
 * Without this hook, pressing the hardware back button on those routes
 * falls through to Capacitor's default behavior, which was causing the
 * app to dump the user back at "/" (home) instead of going back to
 * wherever they came from (e.g. /profile).
 *
 * Call this once in every top-level route component that lives outside
 * AppInner, so hardware back behaves the same (go back one step) as the
 * software/UI back button already does via onBack={() => navigate(-1)}.
 */
export function useRouteBackButton() {
  const navigate = useNavigate();

  useEffect(() => {
    const listener = CapacitorApp.addListener('backButton', () => {
      navigate(-1);
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, [navigate]);
}
