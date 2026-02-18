"use client";

import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, ImageIcon, Calendar, TrendingUp } from "lucide-react";
import { GetSubscriptionInfoSuccessType } from "@/types/subscriptions";

// Updated types based on your new getSubscriptionInfo response
interface UsageDisplayProps {
  subscriptionStatus: GetSubscriptionInfoSuccessType;
}

export function UsageDisplay({ subscriptionStatus }: UsageDisplayProps) {
  const { usage, subscription, plan, status } = subscriptionStatus;

  const formatNumber = (num: number) => {
    if (num === Number.POSITIVE_INFINITY) return "∞";
    return num.toLocaleString();
  };

  const getBillingCycleDisplay = (billingCycle: string) => {
    switch (billingCycle.toLowerCase()) {
      case "monthly":
        return "monthly";
      case "yearly":
        return "yearly";
      default:
        return billingCycle.toLowerCase();
    }
  };

  const getStatusBadgeVariant = (planName: string, isActive: boolean) => {
    if (!isActive) return "destructive";
    if (
      planName.toLowerCase().includes("pro") ||
      planName.toLowerCase().includes("premium")
    ) {
      return "default";
    }
    return "secondary";
  };

  return (
    <div className="space-y-4">
      {/* Account Status Warning */}
      {(status.isBanned || status.isSuspended) && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-destructive">
              Account Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status.isBanned && (
              <p className="text-sm text-destructive">
                Account is banned: {status.banReason}
              </p>
            )}
            {status.isSuspended && (
              <div className="text-sm text-destructive">
                <p>Account is suspended: {status.suspensionReason}</p>
                {status.suspensionExpiresAt && (
                  <p className="text-xs mt-1">
                    Expires:{" "}
                    {new Date(status.suspensionExpiresAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
          <Badge
            variant={
              subscription?.isActive
                ? getStatusBadgeVariant(
                    plan?.name || "Free",
                    subscription.isActive
                  )
                : "secondary"
            }
          >
            {plan?.name || "Free"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {plan?.description || "Basic free plan"}
              </p>
              {subscription?.billingCycle && subscription.isActive && (
                <p className="text-xs text-muted-foreground mt-1">
                  Billed {getBillingCycleDisplay(subscription.billingCycle)}
                </p>
              )}
              {!subscription?.isActive && subscription && (
                <p className="text-xs text-destructive mt-1">
                  Subscription {subscription.status.toLowerCase()}
                </p>
              )}
            </div>
            {subscription?.daysUntilRenewal && subscription.isActive && (
              <div className="text-right">
                <p className="text-sm font-medium">
                  {subscription.daysUntilRenewal} days
                </p>
                <p className="text-xs text-muted-foreground">
                  until{" "}
                  {subscription.daysUntilRenewal > 0 ? "renewal" : "expiry"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nuts Usage</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(usage.nutsUsed)} / {formatNumber(usage.nutsLimit)}
            </div>
            {usage.nutsLimit !== Number.POSITIVE_INFINITY ? (
              <>
                <Progress value={usage.nutsPercentage} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {formatNumber(usage.remainingNuts)} nuts remaining
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">
                Unlimited nuts
              </p>
            )}
          </CardContent>
        </Card>

        {/* <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Images</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usage.dailyImageCount} / {formatNumber(usage.dailyLimit)}
            </div>
            {usage.dailyLimit !== Number.POSITIVE_INFINITY ? (
              <>
                <Progress value={usage.dailyPercentage} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {formatNumber(usage.remainingDailyImages)} images remaining
                  today
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">
                Unlimited images
              </p>
            )}
          </CardContent>
        </Card> */}
      </div>

      {/* Generation Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Generation Settings
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{usage.imagesPerGeneration}</p>
              <p className="text-xs text-muted-foreground">
                images per generation
              </p>
            </div>
            {usage.lastImageReset && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  Last reset:{" "}
                  {new Date(usage.lastImageReset).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Features */}
      {plan?.features && plan.features.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Plan Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {plan.features
                .filter((feature) => feature.isEnabled)
                .map((feature) => (
                  <div
                    key={feature.id}
                    className="flex items-start gap-2 text-sm"
                  >
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{feature.name}</p>
                      {feature.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {feature.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {/* Plan Limits */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Plan Limits:
              </p>
              <div className="grid gap-1 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Monthly Nuts:</span>
                  <span>{formatNumber(plan.nutsPerMonth)}</span>
                </div>
                {/* <div className="flex items-center justify-between">
                  <span>Daily Images:</span>
                  <span>{formatNumber(plan.imagesPerDay)}</span>
                </div> */}
                <div className="flex items-center justify-between">
                  <span>Images per Generation:</span>
                  <span>{plan.imagesPerGeneration}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generation Status */}
      <Card className={!status.canGenerateImages ? "border-orange-500" : ""}>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Generation Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                status.canGenerateImages ? "bg-green-500" : "bg-orange-500"
              }`}
            />
            <span className="text-sm font-medium">
              {status.canGenerateImages
                ? "Ready to generate"
                : "Cannot generate images"}
            </span>
          </div>
          {!status.canGenerateImages && (
            <p className="text-xs text-muted-foreground mt-2">
              {status.isBanned && "Account is banned"}
              {status.isSuspended && "Account is suspended"}
              {!status.isBanned &&
                !status.isSuspended &&
                usage.remainingNuts <= 0 &&
                "No nuts remaining"}
              {!status.isBanned &&
                !status.isSuspended &&
                usage.remainingNuts > 0 &&
                usage.remainingDailyImages <= 0 &&
                "Daily image limit reached"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
