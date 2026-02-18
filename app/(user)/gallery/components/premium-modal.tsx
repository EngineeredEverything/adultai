"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Crown, Zap, Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { getAvailablePlans } from "@/actions/subscriptions/info";

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
  requiredPlan?: string;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  nutsPerMonth: number;
  imagesPerDay: number;
  imagesPerGeneration: number;
  monthlyPrice: number;
  yearlyPrice: number | null;
  features: {
    id: string;
    name: string;
    description: string | null;
  }[];
  isRecommended: boolean;
}

interface PlansResponse {
  plans: Plan[];
  currentPlanId: string | null;
  error?: any;
}

export function PremiumModal({
  isOpen,
  onClose,
  feature = "advanced features",
  requiredPlan,
}: PremiumModalProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
    }
  }, [isOpen]);

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getAvailablePlans();

      if (response.error) {
        setError("Failed to load plans");
      } else {
        setPlans(response.plans || []);
        setCurrentPlanId(response.currentPlanId || null);
      }
    } catch (err) {
      setError("Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  // Find the required plan or default to the first available plan
  const targetPlan = plans.find((plan) => plan.id === requiredPlan) || plans[0];

  const formatPrice = (price: number) => {
    return price % 1 === 0 ? price.toString() : price.toFixed(2);
  };

  const formatFeatureValue = (value: number, type: string) => {
    if (value === -1) return "Unlimited";
    return `${value.toLocaleString()} ${type}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-xl">Unlock {feature}</DialogTitle>
          {targetPlan && (
            <DialogDescription>
              Upgrade to {targetPlan.name} to access this feature
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                Loading plans...
              </span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={fetchPlans} variant="outline">
                Try Again
              </Button>
            </div>
          ) : targetPlan ? (
            <>
              {/* Plan Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{targetPlan.name}</span>
                  {targetPlan.isRecommended && (
                    <Badge
                      variant="secondary"
                      className="bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                    >
                      Recommended
                    </Badge>
                  )}
                </div>
                <div className="text-2xl font-bold">
                  ${formatPrice(targetPlan.monthlyPrice)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /month
                  </span>
                </div>
                {targetPlan.yearlyPrice && (
                  <div className="text-sm text-muted-foreground">
                    or ${formatPrice(targetPlan.yearlyPrice)}/year
                  </div>
                )}
                {targetPlan.description && (
                  <p className="text-sm text-muted-foreground">
                    {targetPlan.description}
                  </p>
                )}
              </div>

              {/* Features List */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  What you&apos;ll get:
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {targetPlan.features.slice(0, 4).map((feature) => (
                    <li key={feature.id} className="flex items-center gap-2">
                      <Zap className="h-3 w-3 text-green-500 flex-shrink-0" />
                      <span>{feature.name}</span>
                    </li>
                  ))}
                  {targetPlan.features.length > 4 && (
                    <li className="flex items-center gap-2">
                      <Link
                        href="/subscriptions"
                        className="text-blue-500 hover:underline"
                        onClick={onClose}
                      >
                        See all features
                      </Link>
                    </li>
                  )}
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <Link href="/subscription" onClick={onClose} className="block">
                  <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                    Upgrade Now
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={onClose}
                >
                  Maybe Later
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No plans available</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
