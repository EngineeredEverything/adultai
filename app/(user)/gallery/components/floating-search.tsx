"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FloatingSearchProps {
  children?: React.ReactNode;
  placeholder?: string;
  searchParamKey?: string;
  debounceMs?: number;
  autoSearch?: boolean;
  showSearchButton?: boolean;
  loadingTimeoutMs?: number; // Time before showing loader
}

export default function FloatingSearch({
  children,
  placeholder = "Search...",
  searchParamKey = "q",
  debounceMs = 500,
  autoSearch = true,
  showSearchButton = false,
  loadingTimeoutMs = 500, // Show loader after 200ms
}: FloatingSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const loadingTimer = useRef<NodeJS.Timeout | null>(null);
  const loadingSearchValue = useRef<string | null>(null); // Track the value that started loading

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize search value from URL params on mount
  useEffect(() => {
    const currentSearchValue = searchParams.get(searchParamKey) || "";
    setSearchValue(currentSearchValue);
  }, []); // Only run on mount

  // Monitor URL changes to stop loading when search completes
  useEffect(() => {
    const currentUrlSearchValue = searchParams.get(searchParamKey) || "";

    // If we're loading and the URL now matches what we were searching for, stop loading
    if (isLoading && loadingSearchValue.current !== null) {
      if (currentUrlSearchValue === loadingSearchValue.current) {
        setIsLoading(false);
        loadingSearchValue.current = null;

        // Clear any pending timers
        if (loadingTimer.current) {
          clearTimeout(loadingTimer.current);
        }
      }
    }
  }, [searchParams, searchParamKey, isLoading]);

  // Separate effect to handle URL changes from external navigation (back/forward)
  useEffect(() => {
    const currentUrlSearchValue = searchParams.get(searchParamKey) || "";

    // Only update search value if we're not currently loading and the values differ
    // This prevents conflicts with our loading state management
    if (!isLoading && currentUrlSearchValue !== searchValue) {
      setSearchValue(currentUrlSearchValue);
    }
  }, [searchParams, searchParamKey, isLoading]);

  // Debounced search effect
  useEffect(() => {
    // Clear existing timers
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    if (loadingTimer.current) {
      clearTimeout(loadingTimer.current);
    }

    if (!autoSearch || !searchValue.trim()) {
      setIsLoading(false);
      return;
    }

    // Start loading timer
    loadingTimer.current = setTimeout(() => {
      setIsLoading(true);
      loadingSearchValue.current = searchValue.trim(); // Store the value that triggered loading
    }, loadingTimeoutMs);

    debounceTimer.current = setTimeout(() => {
      handleRouterSearch();
    }, debounceMs);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (loadingTimer.current) {
        clearTimeout(loadingTimer.current);
      }
    };
  }, [searchValue, autoSearch, debounceMs, loadingTimeoutMs]);

  const handleRouterSearch = () => {
    const searchTerm = searchValue.trim();

    const params = new URLSearchParams(searchParams.toString());
    if (searchTerm) {
      params.set(searchParamKey, searchTerm);
    } else {
      params.delete(searchParamKey);
    }

    // Navigate to the same page with updated search params
    router.push(`${pathname}?${params.toString()}`);

    // Set a fallback to stop loading after a reasonable time (safety net)
    setTimeout(() => {
      if (isLoading && loadingSearchValue.current === searchTerm) {
        setIsLoading(false);
        loadingSearchValue.current = null;
      }
    }, 5000); // Stop loading after 5 seconds as fallback
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchValue.trim()) return;

    // Show loading immediately for manual search and store the search value
    if (!isLoading) {
      setIsLoading(true);
      loadingSearchValue.current = searchValue.trim();
    }

    handleRouterSearch();
    // Optionally close the search bar after searching
    // setIsExpanded(false);
  };

  const handleClose = () => {
    setIsExpanded(false);
    setSearchValue("");
    setIsLoading(false);
    loadingSearchValue.current = null;

    // Clear timers
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    if (loadingTimer.current) {
      clearTimeout(loadingTimer.current);
    }

    // Remove the search param from the URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete(searchParamKey);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);

    // If clearing the search, stop loading immediately
    if (!value.trim()) {
      setIsLoading(false);
      loadingSearchValue.current = null;
      if (loadingTimer.current) {
        clearTimeout(loadingTimer.current);
      }
    }
  };

  return (
    <div className="relative">
      {/* Floating Search Button/Bar */}
      <div className="fixed top-4 right-4 z-50">
        <div
          className={`flex items-center transition-all duration-300 ease-in-out ${
            isExpanded ? "bg-background border rounded-full shadow-lg px-2" : ""
          }`}
        >
          {isExpanded ? (
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="flex items-center">
                {showSearchButton && (
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 text-muted-foreground ml-2 p-0 hover:bg-muted rounded-full"
                    disabled={!searchValue.trim() || isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Search className="h-3 w-3" />
                    )}
                  </Button>
                )}

                <div className="relative flex items-center">
                  <Input
                    type="text"
                    placeholder={placeholder}
                    value={searchValue}
                    onChange={handleInputChange}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent min-w-[200px] sm:min-w-[300px] pr-8"
                    autoFocus
                    disabled={isLoading}
                  />

                  {/* Loading indicator inside input */}
                  {isLoading && !showSearchButton && (
                    <div className="absolute right-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0 hover:bg-muted rounded-full"
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <Button
              onClick={() => setIsExpanded(true)}
              size="sm"
              className="rounded-full h-10 w-10 p-0 shadow-lg"
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content Container */}
      <div className="min-h-screen">{children}</div>
    </div>
  );
}
