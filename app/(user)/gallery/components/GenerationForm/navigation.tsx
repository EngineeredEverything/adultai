"use client";

import Link from "next/link";
import Image from "next/image";
import { Roboto_Flex } from "next/font/google";
import { Button } from "@/components/ui/button";
import { Coins } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { User } from "next-auth";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { signOut } from "next-auth/react";
import { Separator } from "@/components/ui/separator";
import { logger } from "@/lib/logger";
import { motion } from "framer-motion";
import { GetCurrentUserInfoSuccessType } from "@/types/user";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

const roboto = Roboto_Flex({ subsets: ["latin"] });

export function Navigation({
  user,
  userNuts,
  isGenerating,
  handleSubmit,
}: {
  user: GetCurrentUserInfoSuccessType | undefined;
  userNuts: number | undefined;
  isGenerating?: boolean;
  handleSubmit?: (e: React.FormEvent) => void;
}) {
  const router = useRouter();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
      toast.success("Signed out successfully", {
        description: "You have been logged out of your account.",
      });
    } catch (error) {
      logger.error("Error signing out:", error);
      toast.error("Error signing out", {
        description: "There was a problem signing out. Please try again.",
      });
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (handleSubmit) {
      handleSubmit(e);
    }
  };

  return (
    <nav
      className={`${roboto.className} fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border/50`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-end h-16">
          {/* Navigation Items */}
          <div className="flex items-center space-x-4">
            <motion.form
              onSubmit={onSubmit}
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="relative flex-1 max-w-md">
                <Input
                  type="text"
                  disabled={isGenerating}
                  placeholder="Describe what you want to see"
                  className="w-full px-4 py-2 bg-primary/20 text-primary-foreground border border-border rounded-lg"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                variant={"outline"}
                disabled={isGenerating || !prompt.trim()}
                className="px-4 py-2 font-medium"
              >
                Generate
              </Button>
            </motion.form>
            {/* TEMPT Counter - Always visible */}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="flex items-center space-x-1 text-sm bg-black/10 px-3 py-1.5 rounded-full hover:bg-black/20 transition-colors cursor-pointer"
                    onClick={() => !user && setIsLoginOpen(true)}
                  >
                    <Coins className="h-4 w-4 text-yellow-400" />
                    <span>{userNuts || 0} TEMPT</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {user
                      ? "Your current TEMPT balance"
                      : "Sign in for daily TEMPT!"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {/* User Menu */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full p-0"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={user.user.image || ""}
                        alt={user.user.name || ""}
                      />
                      <AvatarFallback className="bg-gray-700 text-white text-xs">
                        {user.user.name?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 bg-gray-900 border-gray-800 text-white" align="end" forceMount>
                  <Link href="/dashboard">
                    <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">Dashboard</DropdownMenuItem>
                  </Link>
                  <Link href="/profile">
                    <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">Edit Profile</DropdownMenuItem>
                  </Link>
                  <Link href="/gallery/user">
                    <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">My Images</DropdownMenuItem>
                  </Link>
                  <Link href="/subscription">
                    <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer">Subscription</DropdownMenuItem>
                  </Link>
                  <Separator className="bg-gray-800" />
                  <DropdownMenuItem onClick={handleSignOut} className="hover:bg-gray-800 text-red-400 cursor-pointer">
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
