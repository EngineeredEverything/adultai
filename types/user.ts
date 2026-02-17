import { updateMyUserDetails } from "@/actions/user/update";
import { getCurrentUserInfo, searchUsers } from "@/actions/user/info";
import { deleteMyAccount } from "@/actions/user/delete";

// Types
type UpdateMyUserDetailsResponse = Awaited<
  ReturnType<typeof updateMyUserDetails>
>;
type GetCurrentUserInfoResponse = Awaited<
  ReturnType<typeof getCurrentUserInfo>
>;
type DeleteMyAccountResponse = Awaited<ReturnType<typeof deleteMyAccount>>;

type SearchUsers = Awaited<ReturnType<typeof searchUsers>>;
// Success Types
export type UpdateMyUserDetailsSuccessType = Extract<
  UpdateMyUserDetailsResponse,
  { user: { id: string } }
>;
export type GetCurrentUserInfoSuccessType = Extract<
  GetCurrentUserInfoResponse,
  { user: { id: string } }
>;
export type DeleteMyAccountSuccessType = Extract<
  DeleteMyAccountResponse,
  { success: boolean }
>;
export type SearchUsersSuccessType = Extract<
  SearchUsers,
  { count: number | undefined } 
>;

// Type Guards
export function isUpdateMyUserDetailsSuccess(
  response: UpdateMyUserDetailsResponse
): response is UpdateMyUserDetailsSuccessType {
  return "user" in response && !("error" in response);
}

export function isGetCurrentUserInfoSuccess(
  response: GetCurrentUserInfoResponse
): response is GetCurrentUserInfoSuccessType {
  return "user" in response && !("error" in response);
}

export function isDeleteMyAccountSuccess(
  response: DeleteMyAccountResponse
): response is DeleteMyAccountSuccessType {
  return "success" in response && !("error" in response);
}
export function isSearchUsersSuccess(
  response: SearchUsers
): response is SearchUsersSuccessType {
  return "users" in response && !("error" in response);
}