import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';
import { globalLogger } from './lib/globalLogger';
import { Capacitor } from '@capacitor/core';
import { SafeArea } from '@capacitor-community/safe-area';
import { App as CapacitorApp } from '@capacitor/app';
import { AuthProvider } from './contexts/AuthContext';

// Initialize Safe Area (edge-to-edge).
// NOTE: We intentionally do NOT use @capacitor/status-bar anymore.
// The safe-area plugin's own docs say it conflicts with @capacitor/status-bar
// when both try to control the same system bars — that conflict was the
// root cause of the status bar randomly disappearing/glitching on
// navigation. SafeArea's System Bars API replaces it everywhere.
if (Capacitor.isNativePlatform()) {
  SafeArea.showSystemBars({}).catch(() => {});

  // Re-assert the status bar whenever the app resumes from background,
  // unless a video is actively in fullscreen mode.
  CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      const isVideoFullscreen = document.body.classList.contains('video-fullscreen');
      if (!isVideoFullscreen) {
        SafeArea.showSystemBars({}).catch(() => {});
      }
    }
  });
}

document.documentElement.classList.add('dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HelmetProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .catch(err => console.error('SW registration failed', err));
  });
}
