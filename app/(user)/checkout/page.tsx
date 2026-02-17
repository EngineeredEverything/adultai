import { currentUser } from "@/utils/auth";
import CheckoutPage from "./CheckoutPage";
import { getPlanInfo } from "@/actions/subscriptions/info";
import { isGetPlanInfoSuccess } from "@/types/subscriptions";

export default async function page({
  searchParams,
}: {
  searchParams: Promise<{ plan: string; billing: string }>;
}) {
  const params = await searchParams;
  const user = await currentUser();
  if (!user) {
    // Redirect to login if user is not authenticated
    return {
      redirect: {
        destination:
          "/login?redirect=/" +
          `checkout?plan=${params.plan}&billing=${params.billing}`,
        permanent: false,
      },
    };
  }

  const plan = await getPlanInfo({ planId: params.plan });

  if (!isGetPlanInfoSuccess(plan)) {
    return <>{plan.error}</>;
  }
  return <CheckoutPage user={user} plan={plan} />;
}
