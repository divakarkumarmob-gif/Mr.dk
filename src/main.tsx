import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { globalLogger } from './lib/globalLogger';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

// Ensure globalLogger is initialized
console.log("Logger initialized", globalLogger);

// Initialize Status Bar
if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark });
}

document.documentElement.classList.add('dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .catch(err => console.error('SW registration failed', err));
  });
}
