"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Check,
  Sparkles,
  Zap,
  Clock,
  ImagePlus,
  Palette,
  X,
  Crown,
  Calendar,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Session } from "next-auth";
import MobileBottomNav from "../gallery/components/mobile-bottom-nav";
import {
  GetAvailablePlansSuccessType,
  GetSubscriptionInfoSuccessType,
} from "@/types/subscriptions";
import { BillingCycle } from "@prisma/client";
import { toast } from "sonner";
import { getAvailablePlans } from "@/actions/subscriptions/info";
import { changePlan } from "@/actions/subscriptions/update";

// Helper function to format price in cents to dollars
const formatPrice = (priceInCents: number): string => {
  // return (priceInCents / 100).toFixed(2);
  return priceInCents.toString()
};

// Helper function to get yearly price with discount
const getYearlyPrice = (monthlyPrice: number, yearlyPrice?: number): string => {
  if (yearlyPrice) {
    return formatPrice(yearlyPrice);
  }
  // Apply 20% discount if no yearly price is set
  const discountedPrice = monthlyPrice * 12 * 0.8;
  return formatPrice(discountedPrice);
};

export function SubscriptionPlans({
  session,
  currentSubscription,
  availablePlans,
}: {
  session: Session | null;
  currentSubscription?: GetSubscriptionInfoSuccessType | undefined;
  availablePlans: GetAvailablePlansSuccessType;
}) {
  const [billingInterval, setBillingInterval] = useState<BillingCycle>(
    (currentSubscription?.subscription?.billingCycle as BillingCycle) ||
      BillingCycle.MONTHLY
  );
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  // Handle error case
  if ("error" in availablePlans) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600">
          Error loading plans: {availablePlans.error}
        </p>
      </div>
    );
  }

  const { plans, currentPlanId } = availablePlans;

  const handleSubscribe = async (planId: string) => {
    if (!session) {
      router.push("/login?redirect=/subscription?planid=" + planId);
      return;
    }

    setLoading(planId);

    try {
      // Check if user already has a subscription
      if (currentSubscription?.subscription?.isActive) {
        // Use changePlan for existing subscribers
        const response = await changePlan({
          newPlanId: planId,
          billingCycle: billingInterval,
        });

        if ("error" in response) {
          toast.error("Subscription Error", {
            description:
              response.error ||
              "An error occurred while processing your subscription.",
          });
          return;
        }

        toast.success("Plan Changed", {
          description: `Successfully changed to ${response.subscription.planName} plan.`,
        });

        // Refresh the page to show updated subscription
        router.refresh();
        return;
      }

      // For new subscriptions, redirect to checkout
      setTimeout(() => {
        router.push(`/checkout?plan=${planId}&billing=${billingInterval}`);
      }, 1500);
    } catch (error) {
      toast.error("Error", {
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setLoading(null);
    }
  };

  const getButtonText = (plan: any) => {
    if (!session) return "Get Started";

    if (currentSubscription?.subscription?.isActive) {
      if (currentPlanId === plan.id) {
        return "Current Plan";
      } else {
        return "Change Plan";
      }
    }

    return "Get Started";
  };

  const getButtonVariant = (plan: any) => {
    if (currentPlanId === plan.id) {
      return "secondary";
    }
    return plan.isRecommended ? "default" : "outline";
  };

  const isButtonDisabled = (plan: any) => {
    if (currentPlanId === plan.id) {
      return true;
    }
    return false;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(dateObj);
  };

  // Helper function to get plan features as strings
  const getPlanFeatures = (plan: any): string[] => {
    const features: string[] = [];

    // Add nuts info
    if (plan.nutsPerMonth === -1) {
      features.push("Unlimited TEMPT per month");
    } else {
      features.push(`${plan.nutsPerMonth} nuts per month`);
    }

    // Add images per day
    // if (plan.imagesPerDay === -1) {
    //   features.push("Unlimited images per day");
    // } else {
    //   features.push(`${plan.imagesPerDay} images per day`);
    // }

    // Add images per generation
    features.push(`${plan.imagesPerGeneration} images per generation`);

    // Add plan-specific features
    if (plan.features && plan.features.length > 0) {
      plan.features.forEach((feature: any) => {
        features.push(feature.description || feature.name);
      });
    }

    return features;
  };

  return (
    <div>
      <div className="flex justify-center items-center space-x-2 mb-8">
        <Label htmlFor="billing-toggle">Monthly</Label>
        <Switch
          id="billing-toggle"
          checked={billingInterval === BillingCycle.YEARLY}
          onCheckedChange={(checked) =>
            setBillingInterval(
              checked ? BillingCycle.YEARLY : BillingCycle.MONTHLY
            )
          }
        />
        <div className="flex items-center">
          <Label htmlFor="billing-toggle">Yearly</Label>
          <Badge
            variant="outline"
            className="ml-2 bg-green-50 text-green-700 border-green-200"
          >
            Save 20%
          </Badge>
        </div>
      </div>

      {/* Current Subscription Status */}
      {currentSubscription?.subscription?.isActive && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Crown className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">
                  Current Plan: {currentSubscription.plan?.name}
                </h3>
                <p className="text-sm text-blue-700">
                  {currentSubscription.subscription.billingCycle ===
                  BillingCycle.MONTHLY
                    ? "Monthly"
                    : "Yearly"}{" "}
                  billing
                  {currentSubscription.subscription.daysUntilRenewal && (
                    <span className="ml-2">
                      • Renews in{" "}
                      {currentSubscription.subscription.daysUntilRenewal} days
                    </span>
                  )}
                </p>
              </div>
            </div>
            {currentSubscription.subscription.endDate && (
              <div className="text-right">
                <div className="flex items-center text-sm text-blue-600">
                  <Calendar className="h-4 w-4 mr-1" />
                  {formatDate(currentSubscription.subscription.endDate)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlanId === plan.id;
          const planFeatures = getPlanFeatures(plan);

          return (
            <Card
              key={plan.id}
              className={cn(
                "flex flex-col",
                plan.isRecommended && "border-primary shadow-md relative",
                isCurrentPlan && "border-blue-500 bg-blue-50/50"
              )}
            >
              {plan.isRecommended && !isCurrentPlan && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <Badge className="bg-primary hover:bg-primary">
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              {isCurrentPlan && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <Badge className="bg-blue-600 hover:bg-blue-600">
                    <Crown className="h-3.5 w-3.5 mr-1" />
                    Current Plan
                  </Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle className={cn(isCurrentPlan && "text-blue-900")}>
                  {plan.name}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-bold">
                    $
                    {billingInterval === BillingCycle.MONTHLY
                      ? formatPrice(plan.monthlyPrice)
                      : getYearlyPrice(
                          plan.monthlyPrice,
                          plan.yearlyPrice || 0
                        )}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    /
                    {billingInterval === BillingCycle.MONTHLY
                      ? "month"
                      : "year"}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="flex-grow">
                <div className="flex items-center mb-4">
                  <div className="mr-2 p-1.5 bg-primary/10 rounded-full">
                    <ImagePlus className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-medium">
                    {plan.nutsPerMonth === -1
                      ? "Unlimited TEMPT"
                      : `${plan.nutsPerMonth} nuts per month`}
                  </span>
                </div>

                <div className="space-y-2">
                  {planFeatures.map((feature, i) => (
                    <div key={i} className="flex items-start">
                      <Check className="h-4 w-4 text-green-500 mr-2 mt-1 shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  variant={getButtonVariant(plan)}
                  className={cn(
                    "w-full",
                    isCurrentPlan && "bg-blue-600 hover:bg-blue-700 text-white"
                  )}
                  disabled={isButtonDisabled(plan) || loading === plan.id}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {loading === plan.id ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </div>
                  ) : (
                    getButtonText(plan)
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

    </div>
  );
}
