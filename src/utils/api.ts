export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const origin = window.location.origin;

  // Check if we are running on standard Web Platforms (live on Render or inside AI Studio developer/preview web view)
  const isWeb = 
    origin.includes('onrender.com') || 
    origin.includes('ais-dev') || 
    origin.includes('ais-pre') || 
    (origin.includes('localhost') && window.location.port === '3000');

  if (isWeb) {
    return cleanPath; // Use relative path for web browser environment
  } else {
    // If running in APK/WebView, use the VITE_BACKEND_URL if configured, otherwise fallback to the live Render URL
    const backendBase = import.meta.env.VITE_BACKEND_URL || "https://mrdk.onrender.com";
    return `${backendBase}${cleanPath}`;
  }
}
