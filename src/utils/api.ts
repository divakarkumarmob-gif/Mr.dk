import { Capacitor } from '@capacitor/core';
import { auth, appCheck } from '../lib/firebase';
import { getToken as getAppCheckToken } from 'firebase/app-check';

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const backendBase = import.meta.env.VITE_BACKEND_URL;

  if (Capacitor.isNativePlatform()) {
    // APK / Native Platform / Mobile Environment — always needs the full
    // backend URL since there's no "same origin" to fall back to.
    const base = backendBase || "https://mrdk.onrender.com";
    return `${base}${cleanPath}`;
  }

  // Web: in production the frontend is served by the same Express server
  // as the API, so a relative path is correct. In local dev (Vite dev
  // server on its own port) that relative path resolves to the dev server
  // itself, not the backend — set VITE_BACKEND_URL in .env.local to point
  // it at the real backend (e.g. http://localhost:3000) while developing.
  if (backendBase) {
    return `${backendBase}${cleanPath}`;
  }
  return cleanPath;
}

export async function getAuthHeaders(headers: Record<string, string> = {}): Promise<Record<string, string>> {
  const finalHeaders: Record<string, string> = { ...headers };

  // Delete existing case variants to prevent duplicate Authorization headers in WebViews
  Object.keys(finalHeaders).forEach(key => {
    if (key.toLowerCase() === 'authorization') {
      delete finalHeaders[key];
    }
  });

  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      finalHeaders['Authorization'] = `Bearer ${idToken}`;
    } catch (e) {
      console.warn("Failed to get Firebase Auth ID token:", e);
    }
  }

  if (appCheck) {
    try {
      const appCheckResult = await getAppCheckToken(appCheck, false);
      if (appCheckResult?.token) {
        finalHeaders['X-Firebase-AppCheck'] = appCheckResult.token;
      }
    } catch (e) {
      console.warn("Failed to get Firebase App Check token:", e);
    }
  }

  return finalHeaders;
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = await getAuthHeaders((init?.headers as Record<string, string>) || {});
  return fetch(input, {
    ...init,
    headers,
  });
}

export async function getPdfViewerUrl(pdfUrl: string): Promise<string> {
  const response = await authFetch(getApiUrl('/api/proxy-pdf/token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: pdfUrl }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to get PDF access token');
  }
  const { token } = await response.json();
  return getApiUrl(`/api/proxy-pdf?url=${encodeURIComponent(pdfUrl)}&token=${encodeURIComponent(token)}`);
}

