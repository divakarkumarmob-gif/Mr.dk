export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const origin = window.location.origin;

  // Detection for Web Browser Environment (Standard AI Studio / Deployed Web)
  const isWeb = 
    origin.includes('onrender.com') || 
    origin.includes('ais-dev') || 
    origin.includes('ais-pre') || 
    origin.includes('web-app') ||
    origin.includes('vercel.app') ||
    (origin.includes('localhost') && (window.location.port === '3000' || window.location.port === '5173'));

  if (isWeb) {
    return cleanPath; // Relative path works perfectly for browser-origin apps
  } else {
    // APK / Native Platform / Mobile Environment
    // The origin in Capacitor is usually capacitor://localhost (iOS) or http://localhost (Android)
    
    // PRIORITY 1: Environment variable set during build
    // PRIORITY 2: Hardcoded fallback (Render)
    const backendBase = import.meta.env.VITE_BACKEND_URL || "https://mrdk.onrender.com";
    
    // Log for debugging in Android Logcat / Chrome Inspect
    console.log(`[API Routing] Origin: ${origin}, Routing: ${path} -> ${backendBase}${cleanPath}`);
    
    return `${backendBase}${cleanPath}`;
  }
}
