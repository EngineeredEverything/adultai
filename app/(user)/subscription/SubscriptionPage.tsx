"use client";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { SubscriptionPlans } from "./subscription-plans";
import { FeatureComparison } from "./feature-comparison";
import { currentSession } from "@/utils/auth";
import {
  GetAvailablePlansSuccessType,
  GetSubscriptionInfoSuccessType,
} from "@/types/subscriptions";
import MobileBottomNav from "../gallery/components/mobile-bottom-nav";
import { useRouter } from "next/navigation";

export default function SubscriptionPage({
  currentSubscription,
  session,
  plans,
}: {
  currentSubscription: GetSubscriptionInfoSuccessType;
  session: Awaited<ReturnType<typeof currentSession>>;
  plans: GetAvailablePlansSuccessType;
}) {
  const router = useRouter();
  return (
    <div className="container max-w-6xl mx-auto py-10 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold">Upgrade Your Experience</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Choose the perfect plan to unlock the full potential of our AI image
          generator
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex justify-center items-center min-h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <SubscriptionPlans
          currentSubscription={currentSubscription}
          session={session}
          availablePlans={plans}
        />
      </Suspense>

      {/* <div className="my-16">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold">Need More TEMPT?</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Purchase additional TEMPT to generate more amazing images
          </p>
        </div>

        <Suspense
          fallback={
            <div className="flex justify-center items-center min-h-[200px]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <NutsPackages session={session} />
        </Suspense>
      </div> */}

      <div className="mt-16">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold">Compare Features</h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            See what each plan includes and choose the best option for your
            needs
          </p>
        </div>

        <FeatureComparison />
      </div>

      {/* Mobile bottom navigation */}
      <div className="md:hidden">
        <MobileBottomNav
          user={
            session?.user
              ? {
                  name: session?.user?.name || "",
                  image: session?.user?.image || "",
                  role: session?.user?.role || null,
                  email: session?.user?.email || "",
                }
              : null
          }
          onPlusClick={() => router.push("/gallery?create=true")}
        />
      </div>
    </div>
  );
}
