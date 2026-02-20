"use client";

import { User } from "@/utils/auth";
import { motion } from "framer-motion";
import {
  Home,
  ImageIcon,
  Bell,
  User as UserIcon,
  Plus,
  ImagePlus,
  Box,
  LogOut,
  GalleryThumbnailsIcon,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { signOut } from "next-auth/react";
import {
  GetSubscriptionInfoSuccessType,
  isGetSubscriptionInfoSuccess,
} from "@/types/subscriptions";
import { Role } from "@prisma/client";
import { getSubscriptionInfo } from "@/actions/subscriptions/info";
import { logger } from "@/lib/logger";

interface MobileBottomNavProps {
  onPlusClick: () => void;
  user: {
    name?: string | null;
    image?: string | null;
    role: Role | null;
    email?: string | null;
  } | null;
  // Add subscription props similar to sidebar
}

export default function MobileBottomNav({
  onPlusClick,
  user,
}: MobileBottomNavProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<
    GetSubscriptionInfoSuccessType["plan"] | null
  >(null);
  const [currentUsage, setCurrentUsage] = useState<
    GetSubscriptionInfoSuccessType["usage"] | null
  >(null);
  const [currentSubscriptionStatus, setCurrentSubscriptionStatus] = useState<
    GetSubscriptionInfoSuccessType["subscription"] | null
  >(null);

  useEffect(() => {
    // Fetch subscription info here if needed
    if (!user)  return;
    
    const fetchSubscriptionInfo = async () => {
      // Example API call to fetch subscription info
      const currentSubscriptionStatus = await getSubscriptionInfo();
      const subscriptionStatusSuccess = isGetSubscriptionInfoSuccess(
        currentSubscriptionStatus
      )
        ? currentSubscriptionStatus
        : { subscription: null, usage: null, plan: null };
      setCurrentPlan(subscriptionStatusSuccess.plan);
      setCurrentUsage(subscriptionStatusSuccess.usage);
      setCurrentSubscriptionStatus(subscriptionStatusSuccess.subscription);
    };
    fetchSubscriptionInfo().catch((error) => {
      logger.error("Error fetching subscription info:", error);
    });
  }, []);

  const handleSignOut = () => {
    setIsPopoverOpen(false);
    signOut();
  };

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-800 z-20 px-4 py-2 safe-area-bottom"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center justify-around">
        <Link href={"/gallery"}>
          <motion.button className="p-3 text-white" whileTap={{ scale: 0.9 }}>
            <Home className="w-6 h-6" />
          </motion.button>
        </Link>

        <Link href={"/categories"}>
          <motion.button className="p-3 text-white" whileTap={{ scale: 0.9 }}>
            <GalleryThumbnailsIcon className="w-6 h-6" />
          </motion.button>
        </Link>

        <motion.button
          className="bg-white rounded-full p-4 -mt-6 shadow-lg"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onPlusClick}
        >
          <Plus className="w-6 h-6 text-black" />
        </motion.button>

        <Link href={"/advanced-generate"}>
          <motion.button className="p-3 text-white" whileTap={{ scale: 0.9 }}>
            <ImagePlus className="w-6 h-6" />
          </motion.button>
        </Link>
        {user ?
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <motion.button className="p-3 text-white" whileTap={{ scale: 0.9 }}>
              <UserIcon className="w-6 h-6" />
            </motion.button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-0 mb-4 bg-background border-border"
            align="end"
            side="top"
          >
            <div className="p-4 space-y-4">
              {/* User Info */}
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.image || ""} alt={user.name || ""} />
                  <AvatarFallback>{user.name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>

              {/* Subscription Info */}
              {currentPlan && currentUsage && (
                <Card className="border-border">
                  <CardHeader className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Plan</p>
                        <CardTitle className="text-sm font-medium">
                          {currentPlan.name}
                        </CardTitle>
                      </div>
                      {currentSubscriptionStatus && (
                        <p className="text-xs text-muted-foreground text-right">
                          {currentSubscriptionStatus.daysUntilRenewal !==
                            null &&
                            `${currentSubscriptionStatus.daysUntilRenewal}d left`}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">TEMPT</span>
                        <span>
                          {currentUsage.nutsUsed === -1
                            ? "∞"
                            : `${currentUsage.nutsUsed} / ${currentUsage.nutsLimit}`}
                        </span>
                      </div>
                      {/* <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Images/day
                        </span>
                        <span>
                          {currentUsage.dailyImageCount === -1
                            ? "∞"
                            : `${currentUsage.dailyImageCount}`}
                        </span>
                      </div> */}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Images/gen
                        </span>
                        <span>{currentUsage.imagesPerGeneration}</span>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              )}

              {/* Navigation Links */}
              <div className="space-y-1">
                <Link href="/profile" onClick={() => setIsPopoverOpen(false)}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm h-9"
                  >
                    <UserIcon className="h-4 w-4 mr-3" />
                    Profile
                  </Button>
                </Link>

                <Link
                  href="/gallery/user"
                  onClick={() => setIsPopoverOpen(false)}
                >
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm h-9"
                  >
                    <GalleryThumbnailsIcon className="h-4 w-4 mr-3" />
                    My Images
                  </Button>
                </Link>

                <Link
                  href="/subscription"
                  onClick={() => setIsPopoverOpen(false)}
                >
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm h-9"
                  >
                    <Box className="h-4 w-4 mr-3" />
                    Subscription
                  </Button>
                </Link>

                {/* Admin link for admins/moderators */}
                {(user.role === "ADMIN" || user.role === "MODERATOR") && (
                  <Link href="/admin" onClick={() => setIsPopoverOpen(false)}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm h-9"
                    >
                      <UserCog className="h-4 w-4 mr-3" />
                      Admin
                    </Button>
                  </Link>
                )}
              </div>

              {/* Sign Out */}
              <div className="pt-3 border-t border-border">
                <Button
                  variant="ghost"
                  onClick={handleSignOut}
                  className="w-full justify-start text-sm h-9 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <LogOut className="h-4 w-4 mr-3" />
                  Sign Out
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover> : (
          <Link href="/auth/login">
            <motion.button className="p-3 text-white" whileTap={{ scale: 0.9 }}>
              <UserIcon className="w-6 h-6" />
            </motion.button>
          </Link>
        )}
       
      </div>
    </motion.div>
  );
}
