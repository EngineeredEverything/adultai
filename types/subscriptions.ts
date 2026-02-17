import { getAvailablePlans, getPlanInfo, getSubscriptionInfo } from "@/actions/subscriptions/info";
import { createSubscription } from "@/actions/subscriptions/create";
import { updateSubscription } from "@/actions/subscriptions/update";
import { deleteSubscription } from "@/actions/subscriptions/delete";

// Types
type GetSubscriptionInfoResponse = Awaited<
    ReturnType<typeof getSubscriptionInfo>
>;
type GetAvailablePlansResponse = Awaited<
    ReturnType<typeof getAvailablePlans>
>;
type GetPlanInfoResponse = Awaited<
    ReturnType<typeof getPlanInfo>
>
type CreateSubscriptionResponse = Awaited<
    ReturnType<typeof createSubscription>
>;
type UpdateSubscriptionResponse = Awaited<
    ReturnType<typeof updateSubscription>
>;
type DeleteSubscriptionResponse = Awaited<
    ReturnType<typeof deleteSubscription>
>;

// Success Types
export type GetSubscriptionInfoSuccessType = Extract<
    GetSubscriptionInfoResponse,
    { subscription: { id: string } | null }
>;
export type GetAvailablePlansSuccessType = Extract<
    GetAvailablePlansResponse,
    { plans: Array<{ id: string; name: string; }> }
>
export type GetPlanInfoSuccessType = Extract<
    GetPlanInfoResponse,
    { plan: { id: string; name: string; } }
>
export type CreateSubscriptionSuccessType = Extract<
    CreateSubscriptionResponse,
    { subscription: { id: string } }
>;
export type UpdateSubscriptionSuccessType = Extract<
    UpdateSubscriptionResponse,
    { subscription: { id: string } }
>;
export type DeleteSubscriptionSuccessType = Extract<
    DeleteSubscriptionResponse,
    { success: boolean }
>;

// Type Guards
export function isGetSubscriptionInfoSuccess(
    response: GetSubscriptionInfoResponse
): response is GetSubscriptionInfoSuccessType {
    return "subscription" in response && !("error" in response);
}

export function isGetAvailablePlansSuccess(
    response: GetAvailablePlansResponse
): response is GetAvailablePlansSuccessType {
    return "plans" in response && !("error" in response);
}

export function isGetPlanInfoSuccess(
    response: GetPlanInfoResponse
): response is GetPlanInfoSuccessType {
    return "plan" in response && !("error" in response);
}

export function isCreateSubscriptionSuccess(
    response: CreateSubscriptionResponse
): response is CreateSubscriptionSuccessType {
    return "subscription" in response && !("error" in response);
}

export function isUpdateSubscriptionSuccess(
    response: UpdateSubscriptionResponse
): response is UpdateSubscriptionSuccessType {
    return "subscription" in response && !("error" in response);
}

export function isDeleteSubscriptionSuccess(
    response: DeleteSubscriptionResponse
): response is DeleteSubscriptionSuccessType {
    return "success" in response && !("error" in response);
}