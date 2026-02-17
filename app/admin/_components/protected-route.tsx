"use client";

import type React from "react";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { User } from "next-auth";
import { Role } from "@prisma/client";

interface ProtectedRouteProps {
  // user: User | undefined;
  children: React.ReactNode;
}

export default function ProtectedRoute({
  // user,
  children,
}: ProtectedRouteProps) {
  const { isLoading, user } = useAuth();
  const router = useRouter();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
      </div>
    );
  }

  if (!user) {
    router.push("/auth/login");
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
        </div>
      </>
    );
  }

  if (user.role !== Role.ADMIN && user.role !== Role.MODERATOR) {
    router.push("/auth/login");
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
        </div>
      </>
    );
  }
  return <>{children}</>;
}
