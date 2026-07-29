import { Capacitor } from '@capacitor/core';

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const backendBase = import.meta.env.VITE_BACKEND_URL;

  if (Capacitor.isNativePlatform()) {
    // APK / Native Platform / Mobile Environment — always needs the full
    // backend URL since there's no "same origin" to fall back to.
    const base = backendBase || "https://mrdk.onrender.com";
    console.log(`[API Routing] Routing: ${path} -> ${base}${cleanPath}`);
    return `${base}${cleanPath}`;
  }

  // Web: in production the frontend is served by the same Express server
  // as the API, so a relative path is correct. In local dev (Vite dev
  // server on its own port) that relative path resolves to the dev server
  // itself, not the backend — set VITE_BACKEND_URL in .env.local to point
  // it at the real backend (e.g. http://localhost:3000) while developing.
  if (backendBase) {
    console.log(`[API Routing] Routing: ${path} -> ${backendBase}${cleanPath}`);
    return `${backendBase}${cleanPath}`;
  }
  return cleanPath;
}
