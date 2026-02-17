"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PayPalScriptProvider,
  PayPalButtons,
  PayPalButtonsComponentProps,
  ReactPayPalScriptOptions,
} from "@paypal/react-paypal-js";
import { Loader2 } from "lucide-react";
import MobileBottomNav from "../gallery/components/mobile-bottom-nav";
import { User } from "next-auth";
import { GetPlanInfoSuccessType } from "@/types/subscriptions";
import { logger } from "@/lib/logger";


export default function CheckoutPage({
  user,
  plan,
}: {
  user: User;
  plan: GetPlanInfoSuccessType;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan");
  const billing = searchParams.get("billing") as "monthly" | "yearly";
  const [planDetails, setPlanDetails] = useState(plan);
  const [loading, setLoading] = useState(false); // Set to false since plan is already passed

  // Setup PayPal
  const paypalOptions: ReactPayPalScriptOptions = {
    clientId:
      "AZtoVKb07XrS0g6Ttn0_hUjCoRnHvgN90dqLtFKL1SgG4yonQwZ7iKviMeKFsOQs-z-bfqHBdeO95Q59",
    currency: "USD",
  };

  const paypalStyle: PayPalButtonsComponentProps["style"] = {
    shape: "rect",
    layout: "vertical",
    label: "pay",
  };

  // Helper function to get price based on billing type
  const getPrice = (billing: "monthly" | "yearly") => {
    if (billing === "monthly") {
      return planDetails.plan.monthlyPrice;
    } else {
      return planDetails.plan.yearlyPrice || 0;
    }
  };

  const createOrder: PayPalButtonsComponentProps["createOrder"] = (
    data,
    actions
  ) => {
    if (!planDetails || !billing || !user?.id)
      return actions.order.create({
        purchase_units: [],
        intent: "CAPTURE",
      });

    const price = getPrice(billing);

    return actions.order.create({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: String(price),
          },
          description: `${planDetails.plan.name} (${billing}) Plan`,
          custom_id: JSON.stringify({
            userId: user.id,
            planId,
            billing,
          }),
        },
      ],
    });
  };

  if (!planId || !billing) {
    return (
      <div className="text-center py-20">Missing plan or billing info.</div>
    );
  }

  // Check if yearly billing is available
  if (billing === "yearly" && !planDetails.plan.yearlyPrice) {
    return (
      <div className="text-center py-20">
        Yearly billing is not available for this plan.
      </div>
    );
  }

  return (
    <div className="container max-w-md mx-auto py-20">
      <div className="text-center">
        {loading || !planDetails ? (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">
              Preparing your checkout...
            </h1>
            <p className="text-muted-foreground">
              Subscription: {planId} ({billing})
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-4">Complete Payment</h1>
            <div className="bg-card rounded-lg border p-6 text-left">
              <div className="mb-4">
                <h2 className="font-semibold">Plan: {planDetails.plan.name}</h2>
                <p>Billing: {billing}</p>
                <p>Price: ${getPrice(billing)}</p>

                {/* Additional plan details */}
                <div className="mt-3 text-sm text-muted-foreground">
                  <p>• {planDetails.plan.nutsPerMonth} nuts per month</p>
                  <p>• {planDetails.plan.imagesPerDay} images per day</p>
                  <p>
                    • {planDetails.plan.imagesPerGeneration} images per
                    generation
                  </p>
                </div>
              </div>

              <PayPalScriptProvider options={paypalOptions}>
                <PayPalButtons
                  createOrder={createOrder}
                  style={paypalStyle}
                  onApprove={async (data, actions) => {
                    if (actions.order) {
                      const details = await actions.order.capture();
                      logger.info("Transaction completed:", details);
                      router.push("/subscription?success=true");
                    }
                  }}
                  onError={(err) => {
                    console.error("PayPal error:", err);
                  }}
                />
              </PayPalScriptProvider>

              <p className="text-sm text-muted-foreground mt-4">
                This is a demo checkout. In production, connect with a real
                payment processor.
              </p>
            </div>
          </>
        )}
      </div>

      <div className="md:hidden">
        <MobileBottomNav
          user={user}
          onPlusClick={() => router.push("/gallery?create=true")}
        />
      </div>
    </div>
  );
}
