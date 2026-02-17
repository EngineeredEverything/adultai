import { searchUsers } from "@/actions/user/info";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import UserManagement from "../_components/user-management";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const DEFAULT_ITEMS_PER_PAGE = 20;

// Loading component
function UserManagementSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters Skeleton */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="w-[150px] h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="w-[150px] h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>

      {/* Users List Skeleton */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Utility function to safely parse search params
function parseSearchParams(searchParams: {
  [key: string]: string | string[] | undefined;
}) {
  const getString = (key: string): string => {
    const value = searchParams[key];
    return typeof value === "string" ? value : "";
  };

  const getNumber = (
    key: string,
    defaultValue: number,
    min = 1,
    max = Number.POSITIVE_INFINITY
  ): number => {
    const value = searchParams[key];
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      return isNaN(parsed)
        ? defaultValue
        : Math.max(min, Math.min(max, parsed));
    }
    return defaultValue;
  };

  const getStringArray = (key: string): string[] => {
    const value = searchParams[key];
    if (typeof value === "string") {
      return value.split(",").filter(Boolean);
    }
    return [];
  };

  return {
    search: getString("search"),
    page: getNumber("page", 1),
    limit: getNumber("limit", DEFAULT_ITEMS_PER_PAGE, 1, 100),
    role: getStringArray("role"),
    status: getString("status"),
    subscription: getString("subscription"),
  };
}

// Build filters object from parsed params
function buildFilters(params: ReturnType<typeof parseSearchParams>) {
  const filters: {
    role?: string[];
    subscription?: string[];
    status?: string[];
  } = {};

  // Handle role filter
  if (params.role.length > 0 && !params.role.includes("all")) {
    filters.role = params.role;
  }

  // Handle subscription filter
  if (params.subscription && params.subscription !== "all") {
    filters.subscription = [params.subscription];
  }

  // Handle status filter
  if (params.status && params.status !== "all") {
    filters.status = [params.status];
  }

  return filters;
}

async function UserManagementContent({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const resolvedSearchParams = await searchParams;

  // Parse search params safely
  const params = parseSearchParams(resolvedSearchParams);

  // Calculate pagination
  const pageStart = (params.page - 1) * params.limit;
  const pageEnd = pageStart + params.limit;

  // Build filters
  const filters = buildFilters(params);

  try {
    const result = await searchUsers(params.search, filters, {
      users: {
        images: {
          count: true,
        },
        role: {},
        sessions: { count: true, active: true },
        preferences: {},
      },
      limit: {
        start: pageStart,
        end: pageEnd,
      },
      count: true,
    });

    if ("error" in result) {
      return (
        <>
          <UserManagement
            users={[]}
            totalCount={0}
            currentPage={params.page}
            itemsPerPage={params.limit}
            searchParams={parseSearchParams(searchParams)}
          />
        </>
      );
    }

    return (
      <UserManagement
        users={result.users}
        totalCount={result.count || 0}
        currentPage={params.page}
        itemsPerPage={params.limit}
        searchParams={parseSearchParams(searchParams)}
      />
    );
  } catch (error) {
    console.error("Error in UserManagementContent:", error);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage users, roles, and moderation actions
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-500">
              An error occurred while loading users.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default async function UsersPage(props: PageProps) {
  const searchParams = await props.searchParams;

  return (
    <Suspense fallback={<UserManagementSkeleton />}>
      <UserManagementContent searchParams={searchParams} />
    </Suspense>
  );
}
