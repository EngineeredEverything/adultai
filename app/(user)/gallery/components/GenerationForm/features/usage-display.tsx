"use client";

import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { GetSubscriptionInfoSuccessType } from "@/types/subscriptions";

interface UsageDisplayProps {
  subscriptionStatus: GetSubscriptionInfoSuccessType;
}

export const UsageDisplay = memo(function UsageDisplay({
  subscriptionStatus,
}: UsageDisplayProps) {
  const { plan, usage } = subscriptionStatus;

  if (!plan) return null;

  const formatLimit = (limit: number) => {
    return limit === Number.POSITIVE_INFINITY ? "Unlimited" : limit.toString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Usage Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>TEMPT Used</span>
            <span>
              {usage.nutsUsed} / {formatLimit(usage.nutsLimit)}
            </span>
          </div>
          {usage.nutsLimit !== Number.POSITIVE_INFINITY && (
            <Progress value={usage.nutsPercentage} className="h-2" />
          )}
        </div>

        {/* <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Daily Images</span>
            <span>
              {usage.dailyImageCount} / {formatLimit(usage.dailyLimit)}
            </span>
          </div>
          {usage.dailyLimit !== Number.POSITIVE_INFINITY && (
            <Progress value={usage.dailyPercentage} className="h-2" />
          )}
        </div> */}

        <div className="pt-2 border-t">
          <div className="text-sm text-muted-foreground">
            Plan: <span className="font-medium">{plan.name}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
