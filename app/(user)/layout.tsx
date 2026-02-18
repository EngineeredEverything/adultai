import { Metadata } from "next";
import { getCurrentUserInfo } from "@/actions/user/info";
import { isGetCurrentUserInfoSuccess } from "@/types/user";
import { UserLayoutMetadata } from "./metadata";
import { Sidebar } from "./_components/sidebar";
import { getSubscriptionInfo } from "@/actions/subscriptions/info";
import { isGetSubscriptionInfoSuccess } from "@/types/subscriptions";

export const metadata: Metadata = UserLayoutMetadata;

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dbUser = await getCurrentUserInfo({
    role: {},
  });
  const currentSubscriptionStatus = await getSubscriptionInfo();
  const subscriptionStatusSuccess = isGetSubscriptionInfoSuccess(
    currentSubscriptionStatus
  )
    ? currentSubscriptionStatus
    : { subscription: null, usage: null, plan: null };
  const dbUserSuccess = isGetCurrentUserInfoSuccess(dbUser) ? dbUser : null;
  return (
    <Sidebar
      user={dbUserSuccess?.user}
      userNuts={dbUserSuccess?.user?.nuts}
      currentSubscriptionStatus={subscriptionStatusSuccess.subscription}
      currentUsage={subscriptionStatusSuccess.usage}
      currentPlan={subscriptionStatusSuccess.plan}
    >
      {children}
    </Sidebar>
  );
}
