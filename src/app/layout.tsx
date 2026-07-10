import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthHashRedirect } from "./auth-hash-redirect";
import { PwaInstallSuppressor } from "./pwa-install-suppressor";
import { ThemeController } from "./theme-controller";
import { normalizedLanguage } from "@/lib/localization";
import {
  brandShareImage,
  brandShareImageAlt,
  shareImage,
  siteDescription,
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
  icons: {
    apple: "/icons/icon-512.png",
    icon: [
      { sizes: "192x192", type: "image/png", url: "/icons/icon-192.png" },
      { sizes: "512x512", type: "image/png", url: "/icons/icon-512.png" },
      { type: "image/svg+xml", url: "/icon.svg?v=ttc-shield" },
    ],
  },
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(siteUrl),
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
    index: true,
  },
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

async function preferredDocumentLanguage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) return "en";

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", userId)
    .maybeSingle<{ preferred_language: string | null }>();

  return normalizedLanguage(profile?.preferred_language);
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await preferredDocumentLanguage();

  return (
    <html
      lang={language}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AuthHashRedirect />
        <PwaInstallSuppressor />
        <ThemeController />
        {children}
      </body>
    </html>
  );
}
