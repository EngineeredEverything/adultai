import type React from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { currentUser } from "@/utils/auth";
import { getCurrentUserInfo } from "@/actions/user/info";
import ProtectedRoute from "./_components/protected-route";
import AdminLayout from "./_components/admin-layout";

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <AuthProvider>
      <ProtectedRoute>
        <AdminLayout>{children}</AdminLayout>
      </ProtectedRoute>
    </AuthProvider>
  );
}
