import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthHashRedirect } from "./auth-hash-redirect";
import { normalizedLanguage } from "@/lib/localization";
import { siteDescription, siteName, siteUrl } from "@/lib/site";
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
  description: siteDescription,
  icons: {
    icon: "/icon.svg?v=ttc-shield",
  },
  metadataBase: new URL(siteUrl),
  openGraph: {
    description: siteDescription,
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
        {children}
      </body>
    </html>
  );
}
