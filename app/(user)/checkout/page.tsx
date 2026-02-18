import { currentUser } from "@/utils/auth";
import StripeCheckout from "./StripeCheckout";
import { getPlanInfo } from "@/actions/subscriptions/info";
import { isGetPlanInfoSuccess } from "@/types/subscriptions";
import { redirect } from "next/navigation";

export default async function page({
  searchParams,
}: {
  searchParams: Promise<{ plan: string; billing: string }>;
}) {
  const params = await searchParams;
  const user = await currentUser();
  
  if (!user) {
    redirect(`/auth/login?callbackUrl=/checkout?plan=${params.plan}&billing=${params.billing}`);
  }

  if (!params.plan || !params.billing) {
    redirect("/subscription");
  }

  const plan = await getPlanInfo({ planId: params.plan });

  if (!isGetPlanInfoSuccess(plan)) {
    return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Error</h2>
        <p className="text-gray-400">{plan.error}</p>
      </div>
    </div>;
  }
  
  return (
    <StripeCheckout 
      user={user} 
      plan={plan} 
      planId={params.plan}
      billing={params.billing as "monthly" | "yearly"}
    />
  );
}
