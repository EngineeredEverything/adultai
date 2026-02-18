import { getAllComments } from "@/actions/comments/info";
import { createComment } from "@/actions/comments/create";

type GetAllCommentsResponse = Awaited<ReturnType<typeof getAllComments>>;
type CreateCommentResponse = Awaited<ReturnType<typeof createComment>>;

export type GetAllCommentsResponseSuccessType = Extract<
  GetAllCommentsResponse,
  { id: string }[]
>;

export type CreateCommentResponseSuccessType = Extract<
  CreateCommentResponse,
  { id: string }
>;

export function isGetAllCommentsResponseSuccess(
  response: GetAllCommentsResponse
): response is GetAllCommentsResponseSuccessType {
  return "comments" in response && !("error" in response);
}

export function isCreateCommentResponseSuccess(
  response: CreateCommentResponse
): response is CreateCommentResponseSuccessType {
  return "id" in response && !("error" in response);
}
