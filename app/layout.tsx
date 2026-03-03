import type { Metadata } from "next";
import "./globals.css";
import boldena from "@/fonts/boldena";
import { RootLayoutMetadata } from "./metadata";
import { Toaster } from "@/components/ui/sonner";
import { AgeVerificationProvider } from "./_components/age-verification-provider";

export const metadata = RootLayoutMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // No SSR cookie check — AgeVerificationProvider checks client-side on mount.
  // This eliminates the blocking async call that was causing 16s page loads.
  return (
    <html lang="en">
      <head>
        {/* Preconnect to CDN for faster image loads */}
        <link rel="preconnect" href="https://adultai-com.b-cdn.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://adultai-com.b-cdn.net" />
      </head>
      <body className={`${boldena.className} antialiased dark`}>
        <AgeVerificationProvider initialVerified={false}>
          {children}
          <Toaster />
        </AgeVerificationProvider>
      </body>
    </html>
  );
}
