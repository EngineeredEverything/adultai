"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { currentUser } from "@/utils/auth";
import { User } from "next-auth";
import { Role } from "@prisma/client";
import { signOut } from "next-auth/react";

interface AuthContextType {
  user: User | null;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored user on mount
    // const storedUser = localStorage.getItem("admin-user")
    const fetchUser = async () => {
      const user = await currentUser();
      // If you want to use the fetched user, set it here:
      setUser(user ?? null);
      setIsLoading(false);
    };
    fetchUser();
  }, []);

  const logoutAction = () => {
    setUser(null);
    signOut();
  };

  return (
    <AuthContext.Provider
      value={{ user, logout: logoutAction, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
