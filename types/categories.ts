import { getAllCategories } from "@/actions/category/info";

export type getAllCategoriesResponse = Awaited<ReturnType<typeof getAllCategories>>;

export type getAllCategoriesResponseSuccessType = Extract<
    getAllCategoriesResponse,
    Array<{ id: string }>
>

export function isGetAllCategoriesResponseSuccess(
  response: getAllCategoriesResponse
): response is getAllCategoriesResponseSuccessType {
  return Array.isArray(response) && response.length > 0 && "id" in response[0];
}