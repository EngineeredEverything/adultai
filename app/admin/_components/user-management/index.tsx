"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  UserX,
  Shield,
  MoreHorizontal,
  Mail,
  Calendar,
  Activity,
  ChevronLeft,
  ChevronRight,
  Download,
  ShieldCheck,
  UserCheck,
  Loader2,
  ImageIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ViewProfileModal } from "./ViewProfileModal";
import { SendMessageModal } from "./SendMessageModal";
import { Role } from "@prisma/client";
import { SuspendUserModal } from "./SuspendUserModal";
import { BanUserModal } from "./BanUserModal";
import { UnsuspendUserModal } from "./UnsuspendUserModal";
import { UnbanUserModal } from "./UnbanUserModal";
import { plans } from "@/data/Plans";
import { getUserImageByEmail } from "@/lib/utils";
import { useUserActions } from "./hooks/useUserActions";
import type { UserManagementProps } from "./types/user";
import { logger } from "@/lib/logger";
import Link from "next/link";
import Image from "next/image";
import { AspectRatio } from "@/components/ui/aspect-ratio";

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function UserManagement({
  users,
  totalCount = 0,
  currentPage = 1,
  itemsPerPage = 20,
  searchParams,
}: UserManagementProps) {
  const router = useRouter();
  const userActions = useUserActions();

  // Initialize state from URL params
  const [searchTerm, setSearchTerm] = useState(searchParams.search || "");
  const [roleFilter, setRoleFilter] = useState(searchParams.role[0] || "all");
  const [subscriptionFilter, setSubscriptionFilter] = useState(
    searchParams.subscription || "all"
  );
  const [statusFilter, setStatusFilter] = useState(
    searchParams.status || "all"
  );

  // Debounced search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Memoized calculations
  const totalPages = useMemo(
    () => Math.ceil(totalCount / itemsPerPage),
    [totalCount, itemsPerPage]
  );

  const startItem = useMemo(
    () => (currentPage - 1) * itemsPerPage + 1,
    [currentPage, itemsPerPage]
  );

  const endItem = useMemo(
    () => Math.min(currentPage * itemsPerPage, totalCount),
    [currentPage, itemsPerPage, totalCount]
  );

  // Calculate stats from users data
  const stats = useMemo(() => {
    const activeToday = users.filter((userItem) =>
      userItem.sessions?.sessions?.some(
        (session) =>
          session.updatedAt &&
          new Date(session.updatedAt).toDateString() ===
            new Date().toDateString()
      )
    ).length;

    const suspendedUsers = users.filter(
      (userItem) => userItem.user.isSuspended
    ).length;

    const bannedUsers = users.filter(
      (userItem) => userItem.user.isBanned
    ).length;

    return {
      total: totalCount,
      activeToday,
      suspended: suspendedUsers,
      banned: bannedUsers,
    };
  }, [users, totalCount]);

  // Optimized URL update function
  const updateSearchParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      const params = new URLSearchParams();

      Object.entries(searchParams).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, v));
        } else {
          params.append(key, value.toString());
        }
      });

      let shouldResetPage = false;

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "all" || value === "" || value === 0) {
          params.delete(key);
        } else {
          params.set(key, value.toString());
        }

        // Reset to first page when filters change (except for page and limit changes)
        if (key !== "page" && key !== "limit") {
          shouldResetPage = true;
        }
      });

      if (shouldResetPage && !updates.page) {
        params.delete("page");
      }

      // Use replace to avoid adding to history stack
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  // Effect for debounced search
  useEffect(() => {
    if (debouncedSearchTerm !== searchParams.search) {
      updateSearchParams({ search: debouncedSearchTerm || null });
    }
  }, [debouncedSearchTerm, searchParams.search, updateSearchParams]);

  // Filter handlers
  const handleRoleChange = useCallback(
    (value: string) => {
      setRoleFilter(value);
      updateSearchParams({ role: value === "all" ? null : value });
    },
    [updateSearchParams]
  );

  const handleSubscriptionChange = useCallback(
    (value: string) => {
      setSubscriptionFilter(value);
      updateSearchParams({ subscription: value === "all" ? null : value });
    },
    [updateSearchParams]
  );

  const handleStatusChange = useCallback(
    (value: string) => {
      setStatusFilter(value);
      updateSearchParams({ status: value === "all" ? null : value });
    },
    [updateSearchParams]
  );

  const handleItemsPerPageChange = useCallback(
    (value: string) => {
      const newLimit = Number(value);
      updateSearchParams({ limit: newLimit, page: 1 });
    },
    [updateSearchParams]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateSearchParams({ page });
    },
    [updateSearchParams]
  );

  // Utility functions
  const getStatusColor = useCallback((user: any) => {
    if (user.isBanned) return "destructive";
    if (user.isSuspended) return "secondary";
    return "default";
  }, []);

  const getStatusText = useCallback((user: any) => {
    if (user.isBanned) return "Banned";
    if (user.isSuspended) return "Suspended";
    return "Active";
  }, []);

  const getRoleColor = useCallback((role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "default";
      case "moderator":
        return "secondary";
      case "bot":
        return "outline";
      case "user":
        return "outline";
      default:
        return "outline";
    }
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter("all");
    setSubscriptionFilter("all");
    router.push("/admin/users");
  }, [router]);

  // Memoized page numbers
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(
        1,
        currentPage - Math.floor(maxVisiblePages / 2)
      );
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      if (startPage > 1) {
        pages.push(1);
        if (startPage > 2) pages.push("...");
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  }, [totalPages, currentPage]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(
    () =>
      searchTerm ||
      roleFilter !== "all" ||
      statusFilter !== "all" ||
      subscriptionFilter !== "all",
    [searchTerm, roleFilter, statusFilter, subscriptionFilter]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage users, roles, and moderation actions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={clearAllFilters}>
            Clear Filters
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Users
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {stats.total.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {stats.activeToday.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Active Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {stats.suspended.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Suspended</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {stats.banned.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Banned</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={handleRoleChange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value={Role.USER}>User</SelectItem>
                <SelectItem value={Role.BOT}>Bot</SelectItem>
                <SelectItem value={Role.MODERATOR}>Moderator</SelectItem>
                <SelectItem value={Role.ADMIN}>Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={subscriptionFilter}
              onValueChange={handleSubscriptionChange}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Subscription" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subscriptions</SelectItem>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                Active filters:
              </span>
              {searchTerm && (
                <Badge variant="secondary">Search: {searchTerm}</Badge>
              )}
              {roleFilter !== "all" && (
                <Badge variant="secondary">Role: {roleFilter}</Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="secondary">Status: {statusFilter}</Badge>
              )}
              {subscriptionFilter !== "all" && (
                <Badge variant="secondary">
                  Subscription: {subscriptionFilter}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Info and Items Per Page */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Showing {startItem}-{endItem} of {totalCount} users
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Items per page:
            </span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={handleItemsPerPageChange}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {pageNumbers.map((page, index) => (
                <div key={index}>
                  {page === "..." ? (
                    <span className="px-2 py-1 text-sm text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page as number)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Manage user accounts and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users
              .sort((a, b) => (b.images?.count || 0) - (a.images?.count || 0))
              .map(({ user, images, sessions }) => (
                <div
                  key={user.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg gap-4"
                >
                  <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                    {/* Avatar */}
                    <Avatar className="shrink-0">
                      <AvatarImage
                        src={
                          (user.images &&
                            user.images.length > 0 &&
                            user.images[0].path) ||
                          getUserImageByEmail(user.email, user.name) ||
                          "/placeholder.svg?height=40&width=40" ||
                          "/placeholder.svg"
                        }
                      />
                      <AvatarFallback>
                        {user.name?.slice(0, 2).toUpperCase() ||
                          user.email.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* User info + generated image */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/admin/images?userId=${user.id}&private=true`}
                          className="hover:underline"
                        >
                          <h4 className="font-medium truncate">
                            @{user.name || "Unknown"}
                          </h4>
                        </Link>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            <Calendar className="h-3 w-3" />
                            <span className="hidden sm:inline">Joined </span>
                            {new Date(user.createdAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1 shrink-0 hidden md:flex">
                            <Activity className="h-3 w-3" />
                            Last active{" "}
                            {new Date(user.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Thumbnail from generatedImages */}
                      {user.generatedImages.length > 0 && (
                        <div className="w-16 sm:w-20 shrink-0">
                          <AspectRatio
                            ratio={
                              user.generatedImages[0].width &&
                              user.generatedImages[0].height
                                ? user.generatedImages[0].width /
                                  user.generatedImages[0].height
                                : 1
                            }
                          >
                            {user.generatedImages[0].imageUrl ? (
                              <Image
                                src={
                                  user.generatedImages[0].imageUrl ||
                                  "/placeholder.svg"
                                }
                                alt={user.generatedImages[0].prompt}
                                fill
                                sizes="(max-width: 640px) 64px, 80px"
                                className="rounded-md object-cover"
                              />
                            ) : (
                              <div className="w-full h-full rounded-md border flex items-center justify-center">
                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </AspectRatio>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-4">
                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-left sm:text-right text-sm">
                        <div className="font-medium">
                          {images?.count || 0} images
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={getStatusColor(user)}
                          className="shrink-0"
                        >
                          {getStatusText(user)}
                        </Badge>
                        <Badge
                          variant={getRoleColor(user.role)}
                          className="shrink-0"
                        >
                          {user.role}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <ViewProfileModal user={user}>
                          <DropdownMenuItem
                            onSelect={(event) => event.preventDefault()}
                          >
                            View Profile
                          </DropdownMenuItem>
                        </ViewProfileModal>

                        <SendMessageModal user={user}>
                          <DropdownMenuItem
                            onSelect={(event) => event.preventDefault()}
                          >
                            <Mail className="w-4 h-4 mr-2" />
                            Send Message
                          </DropdownMenuItem>
                        </SendMessageModal>

                        <DropdownMenuSeparator />

                        {/* Conditional actions based on user status */}
                        {!user.isSuspended && !user.isBanned && (
                          <SuspendUserModal
                            user={user}
                            onConfirm={(reason, duration) => {
                              logger.info("User suspended:", {
                                reason,
                                duration,
                              });
                            }}
                          >
                            <DropdownMenuItem
                              onSelect={(event) => event.preventDefault()}
                            >
                              {userActions.isLoading("suspend", user.id) ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Shield className="w-4 h-4 mr-2" />
                              )}
                              Suspend User
                            </DropdownMenuItem>
                          </SuspendUserModal>
                        )}

                        {user.isSuspended && !user.isBanned && (
                          <UnsuspendUserModal
                            user={user}
                            onConfirm={() => {
                              logger.info("User unsuspended");
                            }}
                          >
                            <DropdownMenuItem
                              onSelect={(event) => event.preventDefault()}
                            >
                              {userActions.isLoading("unsuspend", user.id) ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <ShieldCheck className="w-4 h-4 mr-2" />
                              )}
                              Unsuspend User
                            </DropdownMenuItem>
                          </UnsuspendUserModal>
                        )}

                        {!user.isBanned && (
                          <BanUserModal
                            user={user}
                            onConfirm={(reason) => {
                              logger.info("User banned:", { reason });
                            }}
                          >
                            <DropdownMenuItem
                              onSelect={(event) => event.preventDefault()}
                              className="text-red-600"
                            >
                              {userActions.isLoading("ban", user.id) ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <UserX className="w-4 h-4 mr-2" />
                              )}
                              Ban User
                            </DropdownMenuItem>
                          </BanUserModal>
                        )}

                        {user.isBanned && (
                          <UnbanUserModal
                            user={user}
                            onConfirm={() => {
                              logger.info("User unbanned");
                            }}
                          >
                            <DropdownMenuItem
                              onSelect={(event) => event.preventDefault()}
                              className="text-green-600"
                            >
                              {userActions.isLoading("unban", user.id) ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <UserCheck className="w-4 h-4 mr-2" />
                              )}
                              Unban User
                            </DropdownMenuItem>
                          </UnbanUserModal>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Bottom Pagination (for mobile) */}
      {totalPages > 1 && (
        <div className="flex justify-center sm:hidden">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="text-sm text-muted-foreground px-2">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {users.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No users found matching your criteria.
            </p>
            <Button
              variant="outline"
              className="mt-4 bg-transparent"
              onClick={clearAllFilters}
            >
              Clear all filters
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
