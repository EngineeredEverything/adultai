import { currentSession } from "@/utils/auth";
import {
  getAvailablePlans,
  getSubscriptionInfo,
} from "@/actions/subscriptions/info";
import {
  isGetAvailablePlansSuccess,
  isGetSubscriptionInfoSuccess,
} from "@/types/subscriptions";
import SubscriptionPage from "./SubscriptionPage";

export default async function page() {
  const session = await currentSession();
  const currentSubscription = await getSubscriptionInfo();
  const plans = await getAvailablePlans();

  if (!isGetSubscriptionInfoSuccess(currentSubscription)) {
    return <>{currentSubscription.error}</>;
  }
  if (!isGetAvailablePlansSuccess(plans)) {
    return <>{plans.error}</>;
  }
  return (
    <SubscriptionPage
      currentSubscription={currentSubscription}
      session={session}
      plans={plans}
    />
  );
}