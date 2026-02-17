import { SubscriptionStatus } from "@/app/(user)/gallery/components/GenerationForm/subscription-utils";
import AdvancedGenerationPage from "./advanced-generation/advanced-generation-page";
import { getSubscriptionInfo } from "@/actions/subscriptions/info";
import { currentUser } from "@/utils/auth";
import { redirect } from "next/navigation";

export default async function Page() {

  const session = await currentUser(); // Assuming you have a function to get the current user session

  if (!session) redirect("/auth/login?callbackUrl=/advanced-generate");

  // Fetch the subscription status
  const response = await getSubscriptionInfo();
  if ('error' in response) {
    throw new Error('Failed to get subscription status');
  }
  return <AdvancedGenerationPage subscriptionStatus={response} />;
}
