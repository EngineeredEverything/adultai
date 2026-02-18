import { authOptions } from "@/auth";
import { NextAuthProvider } from "@/providers/NextAuthProvider";
import { currentSession } from "@/utils/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | AdultAI - AI Image Generation",
    default: "AdultAI - A Safer Way to Adult",
    absolute: "AdultAI - Authentication",
  },
  description:
    "AdultAI's authentication layout ensures secure and seamless user access to the platform. Sign in or sign up to explore advanced AI image generation tools and create unique digital art.",
  keywords: [
    "AI",
    "Image Generation",
    "Art",
    "AdultAI",
    "AI Art",
    "Digital Creation",
    "Authentication",
    "Login",
    "Signup",
    "User Session",
    "NextAuth",
    "Secure Access",
  ],
};

const AuthLayout = async ({ children }: { children: React.ReactNode }) => {
  const session = await currentSession();

  return (
    <NextAuthProvider session={session} type="auth">
      <div className="flex items-center justify-center min-h-screen py-16">
        {children}
      </div>
    </NextAuthProvider>
  );
};

export default AuthLayout;
