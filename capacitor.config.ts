import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.neetmaster.app',
  appName: 'NeetMaster',
  webDir: 'dist',
  // Capacitor's WebView blocks network requests to hosts outside the
  // app's own origin unless they're explicitly whitelisted here. All
  // PDF loads (NCERT / PYQ / Question Bank / proxy-pdf) fetch from the
  // Render backend below — without this, every one of them fails inside
  // the APK (while working fine on the web build, which has no such
  // restriction), which is what shows up to the user as "View Blocked /
  // source server is preventing embedded display".
  server: {
    allowNavigation: [
      'ais-dev-grroz2fukjc4b4szeneyqk-889714482537.asia-southeast1.run.app',
      '*.onrender.com',
      'ncert.nic.in',
      '*.ncert.nic.in',
      'nta.ac.in',
      '*.nta.ac.in',
      'nta.nic.in',
      '*.nta.nic.in',
      'accad.nta.nic.in',
      'raw.githubusercontent.com',
      '*.amazonaws.com',
    ],
  },
  plugins: {
    // Keyboard plugin config intentionally omitted. @capacitor-community/safe-area
    // handles keyboard-triggered webview resizing out of the box, and its own docs
    // warn that setting `resizeOnFullScreen` (previously set to true here) actively
    // interferes with its resize logic — that was the root cause of the black gap
    // above the keyboard.
    SystemBars: {
      // Required on Capacitor v8 so the new built-in CapacitorSystemBars insets
      // handling doesn't fight with @capacitor-community/safe-area over the same
      // system bars / insets.
      insetsHandling: "disable",
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"],
      google: {
        webClientId: "900766773228-18ih7jtctcqv60up90djcg1ifee2h270.apps.googleusercontent.com",
      },
    },
    SplashScreen: {
      // Splash stays visible until App.tsx explicitly calls SplashScreen.hide()
      // after Firebase auth resolves. This prevents blank/login flash (Instagram-style).
      launchAutoHide: false,
      launchShowDuration: 3000, // safety fallback: auto-hide after 3s max
      launchFadeOutDuration: 300,
      backgroundColor: "#0a0f24",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    // StatusBar plugin config intentionally removed — the app now uses
    // @capacitor-community/safe-area exclusively for system bar handling
    // (see src/main.tsx). Keeping both configured at once was causing the
    // native layer to apply overlay/inset behavior twice, which showed up
    // as extra empty space at the top of full-screen pages.
  },
};

export default config;
