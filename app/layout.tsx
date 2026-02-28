import type { Metadata } from "next";
import "./globals.css";
import boldena from "@/fonts/boldena";
import { RootLayoutMetadata } from "./metadata";
import { Toaster } from "@/components/ui/sonner";
import { AgeVerificationProvider } from "./_components/age-verification-provider";
import { getAgeVerification } from "./_components/verifyAge";

export const metadata = RootLayoutMetadata;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isVerified = await getAgeVerification();

  return (
    <html lang="en">
      <head>
        {/* Preconnect to CDN for faster image loads */}
        <link rel="preconnect" href="https://adultai-com.b-cdn.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://adultai-com.b-cdn.net" />
      </head>
      <body className={`${boldena.className} antialiased dark`}>
        <AgeVerificationProvider initialVerified={isVerified}>
          {children}
          <Toaster />
        </AgeVerificationProvider>
      </body>
    </html>
  );
}
