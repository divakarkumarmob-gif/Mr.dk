import { Capacitor } from '@capacitor/core';

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  if (!Capacitor.isNativePlatform()) {
    return cleanPath;
  } else {
    // APK / Native Platform / Mobile Environment
    const backendBase = import.meta.env.VITE_BACKEND_URL || "https://mrdk.onrender.com";
    
    console.log(`[API Routing] Routing: ${path} -> ${backendBase}${cleanPath}`);
    
    return `${backendBase}${cleanPath}`;
  }
}
