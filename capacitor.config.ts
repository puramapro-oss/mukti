import type { CapacitorConfig } from "@capacitor/cli";

/**
 * MUKTI — Capacitor 7 config (P9)
 *
 * Stratégie : web wrapping. L'app web Next.js sert de binaire iOS/Android
 * via WebView avec haptics natifs, push notifications, et préférences locales.
 * Bundle id: dev.purama.mukti.
 *
 * IMPORTANT — App Store Apple §3.1.1 : les écrans iOS NE DOIVENT PAS
 * mentionner de paiement externe. Bouton neutre "Continuer" qui ouvre
 * Universal Link → /subscribe (web).
 */

const config: CapacitorConfig = {
  appId: "dev.purama.mukti",
  appName: "MUKTI",
  webDir: "public", // dummy — server.url prend le dessus (wrapping web live, pas de build statique)
  server: {
    url: "https://mukti.purama.dev",
    androidScheme: "https",
    iosScheme: "https",
    cleartext: false,
    allowNavigation: ["mukti.purama.dev", "auth.purama.dev", "*.stripe.com"],
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#03040a",
    preferredContentMode: "mobile",
    scheme: "MUKTI",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    backgroundColor: "#03040a",
    captureInput: true,
    webContentsDebuggingEnabled: false,
    allowMixedContent: false,
    overrideUserAgent: undefined,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#03040a",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#03040a",
      overlaysWebView: true,
    },
    Haptics: {},
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Preferences: {
      group: "dev.purama.mukti.prefs",
    },
  },
};

export default config;
