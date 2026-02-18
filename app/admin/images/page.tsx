import { Suspense } from "react";
import { searchImages } from "@/actions/images/info";
import { getAllCategories } from "@/actions/category/info";
import { Card, CardContent } from "@/components/ui/card";
import ImageManagementEnhanced from "../_components/image-management";
import AdminStatsDashboard from "../_components/image-management/admin-stats-dashboard";
import { buildFilters, parseSearchParams } from "../_components/image-management/utils/params";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Loading component
function ImageManagementSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="aspect-square bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

async function ImageManagementServer({
  searchParams,
  currentUserId,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
  currentUserId?: string;
}) {
  // Parse search params safely
  const params = parseSearchParams(searchParams);

  // Calculate pagination
  const pageStart = (params.page - 1) * params.limit;
  const pageEnd = pageStart + params.limit;

  // Build filters
  const filters = buildFilters(params);

  try {
    // Fetch categories and images in parallel
    const [categories, result] = await Promise.all([
      getAllCategories(),
      searchImages({
        query: params.search,
        data: {
          limit: {
            start: pageStart,
            end: pageEnd,
          },
          images: {
            comments: { count: true },
            categories: true,
            votes: { count: true },
          },
          count: true,
        },
        filters,
      }),
    ]);

    // Handle search error
    if ("error" in result) {
      return (
        <ImageManagementEnhanced
          categories={categories}
          currentUserId={currentUserId}
          initialData={{
            images: [],
            totalCount: 0,
            currentPage: params.page,
            totalPages: 0,
          }}
          searchParams={searchParams}
        />
      );
    }

    // Success case
    return (
      <ImageManagementEnhanced
        categories={categories}
        currentUserId={currentUserId}
        initialData={{
          images: result.images,
          totalCount: result.count || 0,
          currentPage: params.page,
          totalPages: Math.ceil((result.count || 0) / params.limit),
        }}
        searchParams={searchParams}
      />
    );
  } catch (error) {
    console.error("Error in ImageManagementServer:", error);

    // Fallback error UI
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Image Management</h1>
          <p className="text-muted-foreground">
            Review, moderate, and manage generated images
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-red-600">
                  Error Loading Images
                </h3>
                <p className="text-muted-foreground mt-1">
                  An error occurred while loading images. Please try refreshing
                  the page.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
export default async function ImagesPage(props: PageProps) {
  const searchParams = await props.searchParams;

  return (
    <div className="container mx-auto py-6 flex flex-col gap-5">
      <AdminStatsDashboard />
      <Suspense fallback={<ImageManagementSkeleton />}>
        <ImageManagementServer searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
