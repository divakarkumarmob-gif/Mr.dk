import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.neetmaster.app',
  appName: 'NeetMaster',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"],
      google: {
        webClientId: "900766773228-18ih7jtctcqv60up90djcg1ifee2h270.apps.googleusercontent.com",
      },
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#0a0f24',
    },
  },
};

export default config;
