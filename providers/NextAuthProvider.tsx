"use client";
import { SessionProvider } from "next-auth/react";
import type React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Session } from "next-auth";
import { DEFAULT_AUTH_REDIRECT, DEFAULT_LOGIN_REDIRECT } from "@/routes";
import { Shield, Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";

/**
 * Provides a NextAuth.js session provider for the application.
 * This component wraps the application with the NextAuth.js session provider,
 * handling authentication and authorization logic.
 *
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to be rendered.
 * @param {'private' | 'auth'} props.type - The type of the page, either 'private' or 'auth'.
 * @param {Session | null} props.session - The current NextAuth.js session.
 * @returns {React.ReactElement} - The NextAuth.js session provider component.
 */
export const NextAuthProvider = ({
  children,
  type,
  session,
}: {
  children: React.ReactNode;
  type: "private" | "auth";
  session: Session | null;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const currentPath = pathname || "/";
      const queryString = searchParams?.toString() || "";
      const callbackUrl = queryString
        ? `${currentPath}?${queryString}`
        : currentPath;
      logger.info(`Auth check for path: ${callbackUrl}`);

      if (type === "private" && !session?.user) {
        router.push(
          `${DEFAULT_AUTH_REDIRECT}?callbackUrl=${encodeURIComponent(
            callbackUrl
          )}`
        );
      } else if (type === "auth" && session?.user) {
        router.push(DEFAULT_LOGIN_REDIRECT);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      logger.error("Navigation error:", error);
      setIsLoading(false);
    }
  }, [session, type, router, pathname, searchParams]);

  useEffect(() => {
    const callbackUrl = searchParams.get("callbackUrl");

    // if call back url is  "null" then remove the search param callbackUrl
    if (callbackUrl === "null") {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete("callbackUrl");
      router.replace(`${pathname}?${newSearchParams.toString()}`);
    }
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/10">
        <div className="flex flex-col items-center space-y-6 p-8">
          {/* Main loading animation */}
          <div className="relative">
            {/* Outer rotating ring */}
            <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-primary/20 animate-pulse" />

            {/* Inner spinning loader */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary animate-pulse" />
              <Loader2 className="absolute inset-0 w-16 h-16 animate-spin text-primary/60" />
            </div>

            {/* Glowing effect */}
            <div className="absolute inset-0 w-16 h-16 rounded-full bg-primary/5 animate-ping" />
          </div>

          {/* Loading text with animation */}
          <div className="text-center space-y-2">
            <div className="flex items-center space-x-1">
              <h3 className="text-lg font-semibold text-foreground">
                Authenticating
              </h3>
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1 h-1 bg-primary rounded-full animate-bounce" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              {type === "private"
                ? "Verifying your credentials and securing your session..."
                : "Checking authentication status..."}
            </p>
          </div>

          {/* Progress indicator */}
          <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/50 to-primary rounded-full animate-pulse"
              style={{ width: "60%" }}
            />
          </div>
        </div>
      </div>
    );
  }

  return <SessionProvider>{children}</SessionProvider>;
};

// Enhanced loading component for auth states
export function AuthLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="absolute inset-0 h-8 w-8 rounded-full border-2 border-primary/20" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">Loading...</p>
          <p className="text-xs text-muted-foreground">
            Please wait while we authenticate you
          </p>
        </div>
      </div>
    </div>
  );
}
