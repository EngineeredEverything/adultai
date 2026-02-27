"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { getAllCategories } from "@/actions/category/info";
import { getContentInterests } from "@/actions/user/interests";
import { INTEREST_OPTIONS, getKeywordsForInterests } from "@/lib/interests";
import { getCurrentUserInfo } from "@/actions/user/info";
import { isGetCurrentUserInfoSuccess } from "@/types/user";
import { Spinner } from "@/components/ui/spinner";
import { SlidersHorizontal } from "lucide-react";
import { InterestOnboardingModal, InterestSelector } from "@/components/ui/interest-selector";
import NavComp from "./navComp";

type Category = {
  id: string;
  name: string;
  keywords: string[];
  imageCount: number;
  sampleImage?: {
    id: string;
    imageUrl: string | null;
  } | null;
};

export default function CategoriesClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [user, setUser] = useState<Awaited<ReturnType<typeof getCurrentUserInfo>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [categoriesData, userInterests, userData] = await Promise.all([
          getAllCategories(),
          getContentInterests(),
          getCurrentUserInfo({ role: {}, images: {} }),
        ]);
        setCategories(categoriesData as Category[]);
        setInterests(userInterests);
        setUser(userData);

        // Show onboarding if user has never set interests
        const alreadySet = typeof window !== "undefined"
          ? localStorage.getItem("adultai_interests_set")
          : "1";
        if (!alreadySet && userInterests.length === 0) {
          setShowOnboarding(true);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Build a set of keywords from selected interests (for scoring)
  const interestKeywords = useMemo(() => {
    return new Set(getKeywordsForInterests(interests));
  }, [interests]);

  // Score + sort categories: categories matching interests bubble up
  const sortedCategories = useMemo(() => {
    const filtered = activeFilter
      ? categories.filter(cat => {
          const opt = INTEREST_OPTIONS.find(o => o.id === activeFilter);
          if (!opt) return true;
          const kws = new Set(opt.keywords);
          return cat.keywords.some(k => kws.has(k.toLowerCase())) ||
            kws.has(cat.name.toLowerCase());
        })
      : categories;

    if (!interests.length) return filtered;

    return [...filtered].sort((a, b) => {
      const scoreA = a.keywords.filter(k => interestKeywords.has(k.toLowerCase())).length;
      const scoreB = b.keywords.filter(k => interestKeywords.has(k.toLowerCase())).length;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.imageCount - a.imageCount;
    });
  }, [categories, interests, interestKeywords, activeFilter]);

  async function handleInterestsSaved(newInterests: string[]) {
    setInterests(newInterests);
    setShowOnboarding(false);
    setShowFilter(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("adultai_interests_set", "1");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <>
      {showOnboarding && (
        <InterestOnboardingModal
          initialInterests={interests}
          onDone={handleInterestsSaved}
        />
      )}

      <div className="container mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1">All Categories</h1>
            <p className="text-muted-foreground text-sm">
              {activeFilter
                ? `Showing: ${INTEREST_OPTIONS.find(o => o.id === activeFilter)?.label ?? activeFilter}`
                : interests.length > 0
                  ? "Sorted by your interests"
                  : "Browse all available categories"}
            </p>
          </div>
          <button
            onClick={() => setShowFilter(f => !f)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors
              ${interests.length > 0 || showFilter
                ? "border-pink-500 text-pink-500 bg-pink-500/10"
                : "border-border hover:bg-muted"}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {interests.length > 0 ? `${interests.length} filters` : "Interests"}
          </button>
        </div>

        {/* Inline interest editor */}
        {showFilter && (
          <div className="mb-6 rounded-2xl border border-border bg-card shadow-sm">
            <InterestSelector
              initialInterests={interests}
              onSave={handleInterestsSaved}
              onClose={() => setShowFilter(false)}
            />
          </div>
        )}

        {/* Quick-filter pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveFilter(null)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors
              ${!activeFilter ? "bg-pink-500 text-white border-pink-500" : "border-border hover:bg-muted"}`}
          >
            All
          </button>
          {INTEREST_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setActiveFilter(activeFilter === opt.id ? null : opt.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors flex items-center gap-1.5
                ${activeFilter === opt.id
                  ? "bg-pink-500 text-white border-pink-500"
                  : interests.includes(opt.id)
                    ? "border-pink-500/50 text-pink-500 bg-pink-500/5 hover:bg-pink-500/10"
                    : "border-border hover:bg-muted"}`}
            >
              <span>{opt.emoji}</span> {opt.label}
            </button>
          ))}
        </div>

        {/* Category grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sortedCategories.map((category) => (
            <Link
              key={category.id}
              href={`/gallery/${category.name.toLowerCase()}`}
              className="group"
            >
              <div className="rounded-xl overflow-hidden border border-border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                {category.sampleImage?.imageUrl ? (
                  <div className="aspect-[3/4] relative">
                    <Image
                      unoptimized
                      src={category.sampleImage.imageUrl}
                      alt={category.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Image count badge */}
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                      {category.imageCount.toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <div className="aspect-[3/4] bg-muted flex items-center justify-center relative">
                    <span className="text-muted-foreground text-sm">No image</span>
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                      {category.imageCount.toLocaleString()}
                    </div>
                  </div>
                )}
                <div className="p-3 bg-card">
                  <h3 className="text-sm font-semibold truncate group-hover:text-pink-500 transition-colors">
                    {category.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {category.keywords.slice(0, 3).join(" · ")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {sortedCategories.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-3">No categories match this filter.</p>
            <button onClick={() => setActiveFilter(null)} className="text-pink-500 text-sm hover:underline">
              Show all categories
            </button>
          </div>
        )}
      </div>

      <NavComp user={user && isGetCurrentUserInfoSuccess(user) ? user : null} />
    </>
  );
}
