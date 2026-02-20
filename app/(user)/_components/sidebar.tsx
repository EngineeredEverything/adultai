"use client";
import { logger } from "@/lib/logger";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Box,
  ChevronLeft,
  GalleryThumbnailsIcon,
  ImagePlus,
  Library,
  LogOut,
  UserCog,
  UserIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { ScrollProvider } from "@/providers/scroll-provider";
import Image from "next/image";
import { LoginButton } from "@/components/auth/login-button";
import { Role } from "@prisma/client";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { GetSubscriptionInfoSuccessType } from "@/types/subscriptions";
import SideBarFooter from "./footer";
import SideBarUserNavigation from "./user-navigation";
import { navItems, userNavItems } from "./constant";
import { useSidebar } from "./use-sidebar";
import SearchBar from "./search-bar";

interface WorkingSidebarProps {
  children: React.ReactNode;
  user?: {
    name?: string | null;
    image?: string | null;
    role: Role | null;
  } | null;
  userNuts: number | undefined;
  currentUsage: GetSubscriptionInfoSuccessType["usage"] | null;
  currentSubscriptionStatus: GetSubscriptionInfoSuccessType["subscription"];
  currentPlan?: GetSubscriptionInfoSuccessType["plan"] | null;
}

export function Sidebar({
  user,
  currentSubscriptionStatus,
  currentUsage,
  children,
  currentPlan,
}: WorkingSidebarProps) {
  const {
    expanded,
    isLoginOpen,
    setIsLoginOpen,
    toggleSidebar,
    handleModelClose,
  } = useSidebar();

  const nutsDisplay = () => {
    if (!currentUsage) return null;
    const limit = currentUsage.nutsLimit;
    if (limit === Number.POSITIVE_INFINITY || limit === -1) return "∞ nuts";
    return `${currentUsage.remainingNuts} nuts`;
  };

  return (
    <div className="flex">
      <aside
        className={cn(
          "relative md:flex hidden h-screen flex-col border-r bg-background transition-all duration-300 z-30",
          expanded ? "w-64" : "w-16"
        )}
      >
        {/* Toggle Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSidebar}
          className="absolute -right-3 top-4 z-10 h-6 w-6 rounded-full border bg-background p-0 shadow-sm"
        >
          <ChevronLeft
            className={cn(
              "h-3 w-3 transition-transform",
              !expanded && "rotate-180"
            )}
          />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>

        {/* Main Navigation */}
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto pt-5">
          {/* Logo */}
          <Link href="/" className="px-4 flex items-center space-x-2">
            <Image src="/logo.png" alt="Logo" width={32} height={32} />
            {expanded && <span className="font-bold text-xl">AdultAI</span>}
          </Link>
          <div
            className={cn(
              "mb-2 px-4 text-xs font-medium text-muted-foreground",
              !expanded && "sr-only"
            )}
          >
            A safer way to Adult
          </div>
          <nav className="flex flex-col gap-1 px-2">
            {navItems.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group flex h-10 items-center rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground"
              >
                <item.icon className="h-5 w-5" />
                {expanded ? (
                  <span className="ml-3">{item.title}</span>
                ) : (
                  <div className="absolute left-full ml-2 hidden rounded-md bg-popover px-2 py-1 text-sm text-popover-foreground shadow-md group-hover:block">
                    {item.title}
                  </div>
                )}
              </Link>
            ))}
          </nav>

          {/* User Navigation */}
          {user && userNavItems.length > 0 && (
            <SideBarUserNavigation
              expanded={expanded}
              userNavItems={userNavItems}
            />
          )}
        </div>

        {/* Footer */}
        <SideBarFooter
          user={user}
          expanded={expanded}
          isLoginOpen={isLoginOpen}
          setIsLoginOpen={setIsLoginOpen}
          handleModelClose={handleModelClose}
        />
      </aside>
      <div className="flex flex-col w-full h-screen">
        {/* Top Navigation Bar */}
        <header className="h-16 border-b bg-background flex items-center justify-end px-4">
          <div className="flex items-center gap-3">
            <SearchBar
              placeholder="Search generations..."
              searchParamKey="search"
              debounceMs={500}
              autoSearch={true}
              showSearchButton={true}
            />

            {!user ? (
              <LoginButton isOpen={isLoginOpen} onClose={handleModelClose}>
                <Button size="sm" variant="default">
                  <UserIcon className="h-4 w-4" />
                  <span className="ml-2">Sign In</span>
                </Button>
              </LoginButton>
            ) : (
              <HoverCard openDelay={200}>
                <HoverCardTrigger asChild>
                  <div className="flex items-center gap-2 cursor-pointer select-none">
                    {currentUsage && currentPlan && (
                      <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                        <span className="font-medium text-foreground">{currentPlan.name}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <span>{nutsDisplay()}</span>
                      </span>
                    )}
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.image ?? ""} alt={user.name ?? "User"} />
                      <AvatarFallback>{user.name?.[0] ?? "U"}</AvatarFallback>
                    </Avatar>
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-52 text-xs space-y-2" align="end">
                  <div>
                    <p className="font-medium text-sm">{user.name}</p>
                    <p className="text-muted-foreground">{currentPlan?.name ?? "Free"} plan</p>
                  </div>
                  {currentUsage && (
                    <div className="pt-2 border-t space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nuts used</span>
                        <span className="font-medium">
                          {currentUsage.nutsLimit === Number.POSITIVE_INFINITY || currentUsage.nutsLimit === -1
                            ? "∞"
                            : `${currentUsage.nutsUsed} / ${currentUsage.nutsLimit}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Images/gen</span>
                        <span className="font-medium">{currentUsage.imagesPerGeneration}</span>
                      </div>
                      {currentSubscriptionStatus?.daysUntilRenewal != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Renews in</span>
                          <span className="font-medium">{currentSubscriptionStatus.daysUntilRenewal}d</span>
                        </div>
                      )}
                    </div>
                  )}
                </HoverCardContent>
              </HoverCard>
            )}
          </div>
        </header>

        <ScrollProvider>{children}</ScrollProvider>
      </div>
    </div>
  );
}
