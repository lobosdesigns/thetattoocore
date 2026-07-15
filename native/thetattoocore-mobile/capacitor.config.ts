import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.thetattoocore.app",
  appName: "TheTattooCore",
  plugins: {
    Browser: {
      presentationStyle: "fullscreen",
    },
    SplashScreen: {
      backgroundColor: "#171412",
      launchAutoHide: true,
      launchShowDuration: 1200,
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
  server: {
    allowNavigation: ["thetattoocore.com", "www.thetattoocore.com"],
    androidScheme: "https",
    cleartext: false,
    url: "https://thetattoocore.com/login",
  },
  webDir: "www",
};

export default config;
