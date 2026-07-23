import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthHashRedirect } from "./auth-hash-redirect";
import { PwaInstallSuppressor } from "./pwa-install-suppressor";
import { NativeNotificationProvider } from "./native-notification-provider";
import { ServiceWorkerRegistrar } from "./service-worker-registrar";
import { ThemeController, type ThemePreference } from "./theme-controller";
import { normalizedLanguage } from "@/lib/localization";
import { nativePushQaRoleAllowed } from "@/lib/native-push/qa-access";
import {
  brandShareImage,
  brandShareImageAlt,
  metadataKeywords,
  shareImage,
  siteDescription,
  siteKeywords,
  siteName,
  siteUrl,
} from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  alternates: {
    canonical: siteUrl,
  },
  applicationName: siteName,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: siteName,
  },
  description: siteDescription,
  category: "social networking",
  creator: siteName,
  icons: {
    apple: "/icons/icon-512.png",
    icon: [
      { sizes: "192x192", type: "image/png", url: "/icons/icon-192.png" },
      { sizes: "512x512", type: "image/png", url: "/icons/icon-512.png" },
      { type: "image/svg+xml", url: "/icon.svg?v=ttc-shield" },
    ],
  },
  itunes: {
    appArgument: siteUrl,
    appId: "6791179517",
  },
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(siteUrl),
  keywords: metadataKeywords(siteKeywords),
  openGraph: {
    description: siteDescription,
    images: [shareImage(brandShareImage, brandShareImageAlt)],
    siteName,
    title: siteName,
    type: "website",
    url: siteUrl,
  },
  robots: {
    follow: true,
    googleBot: {
      follow: true,
      index: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    index: true,
  },
  publisher: siteName,
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  twitter: {
    card: "summary_large_image",
    description: siteDescription,
    images: [brandShareImage],
    title: siteName,
  },
};

export const viewport: Viewport = {
  themeColor: "#171412",
};

async function preferredDocumentSettings() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return {
      language: "en",
      role: null,
      themePreference: "system" as ThemePreference,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language, role, theme_preference")
    .eq("id", userId)
    .maybeSingle<{
      preferred_language: string | null;
      role: string | null;
      theme_preference: string | null;
    }>();

  return {
    language: normalizedLanguage(profile?.preferred_language),
    role: profile?.role ?? null,
    themePreference: normalizedThemePreference(profile?.theme_preference),
  };
}

function normalizedThemePreference(value?: string | null): ThemePreference {
  if (value === "light" || value === "dark" || value === "system") return value;

  return "system";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { language, role, themePreference } = await preferredDocumentSettings();
  const nativeDeliveryEnabled =
    process.env.TTC_NATIVE_PUSH_DELIVERY_ENABLED === "true";
  const nativeRegistrationEnabled =
    process.env.TTC_NATIVE_PUSH_REGISTRATION_ENABLED === "true";
  const nativeQaRoleAllowed = nativePushQaRoleAllowed(role);
  const nativeNotificationSetupEnabled =
    process.env.TTC_DEVICE_ALERT_SETUP_ENABLED === "true" &&
    nativeRegistrationEnabled &&
    (nativeDeliveryEnabled || nativeQaRoleAllowed);
  const nativeNotificationQaBuildRestricted =
    nativeNotificationSetupEnabled &&
    !nativeDeliveryEnabled &&
    nativeQaRoleAllowed;

  return (
    <html
      lang={language}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NativeNotificationProvider
          qaBuildRestricted={nativeNotificationQaBuildRestricted}
          setupEnabled={nativeNotificationSetupEnabled}
        >
          <AuthHashRedirect />
          <ServiceWorkerRegistrar />
          <PwaInstallSuppressor />
          <ThemeController initialPreference={themePreference} />
          {children}
        </NativeNotificationProvider>
      </body>
    </html>
  );
}
