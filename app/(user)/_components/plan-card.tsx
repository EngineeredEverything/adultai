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

export default function SideBarPlanCard({
  currentPlan,
  currentUsage,
  currentSubscriptionStatus,
  expanded = true,
}: {
  currentPlan?: GetSubscriptionInfoSuccessType["plan"] | null;
  currentUsage: GetSubscriptionInfoSuccessType["usage"];
  currentSubscriptionStatus?: GetSubscriptionInfoSuccessType["subscription"];
  expanded?: boolean;
}) {
  return (
    <HoverCard openDelay={100}>
      <HoverCardTrigger asChild>
        {expanded ? (
          <Card className="cursor-pointer mb-2 mx-2">
            <CardHeader className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <CardTitle className="text-sm font-medium">
                    {currentPlan?.name}
                  </CardTitle>
                </div>
                {currentSubscriptionStatus && (
                  <p className="text-xs text-muted-foreground text-right">
                    {currentSubscriptionStatus?.daysUntilRenewal !== null &&
                      `${currentSubscriptionStatus?.daysUntilRenewal}d left`}
                  </p>
                )}
              </div>
            </CardHeader>
          </Card>
        ) : (
          <div className="flex justify-center mb-2">
            <div className="h-10 w-10 rounded-md border bg-muted flex items-center justify-center">
              <span className="text-[10px] font-medium text-muted-foreground">
                {currentPlan?.name[0]}
              </span>
            </div>
          </div>
        )}
      </HoverCardTrigger>

      <HoverCardContent className="w-64 text-xs space-y-2">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nuts</span>
            <span>
              {currentUsage.nutsUsed === -1
                ? "∞"
                : `${currentUsage.nutsUsed} / ${currentUsage.nutsLimit}`}
            </span>
          </div>
          {/* <div className="flex justify-between">
                  <span className="text-muted-foreground">Images/day</span>
                  <span>
                    {currentUsage.dailyImageCount === -1
                      ? "∞"
                      : `${currentUsage.dailyImageCount}`}
                  </span>
                </div> */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Images/gen</span>
            <span>{currentUsage.imagesPerGeneration}</span>
          </div>
        </div>

        <div>
          <p className="text-muted-foreground font-medium mb-1">Features:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {currentPlan?.features.map((feature, i) => (
              <li key={feature.id} title={feature.description || undefined}>
                {feature.name}
              </li>
            ))}
          </ul>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
