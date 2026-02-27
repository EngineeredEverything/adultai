"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, SlidersHorizontal } from "lucide-react";

export function CategoriesSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6 animate-pulse">
      <div className="flex justify-between items-center mb-4">
        <div className="h-6 w-40 bg-muted rounded" />
        <div className="h-5 w-32 bg-muted rounded" />
      </div>
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden border border-border">
            <div className="aspect-[3/4] bg-muted" />
            <div className="p-2">
              <div className="h-3 w-16 bg-muted mx-auto rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Categories({
  categories,
  isLoading = false,
  hasInterests = false,
}: {
  categories: {
    id: string;
    name: string;
    keywords: string[];
    imageCount?: number;
    sampleImage: {
      id: string;
      imageUrl: string | null;
    } | null;
  }[];
  isLoading?: boolean;
  hasInterests?: boolean;
}) {
  if (isLoading) {
    return <CategoriesSkeleton />;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">
            {hasInterests ? "For You" : "Top Categories"}
          </h2>
          {hasInterests && (
            <p className="text-xs text-muted-foreground mt-0.5">Sorted by your interests</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/categories"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-pink-500 transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Customize
          </Link>
          <Link
            href="/categories"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline transition-all"
          >
            See all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/gallery/${category.name.toLocaleLowerCase()}`}
            className="group"
          >
            <div className="rounded-xl overflow-hidden border border-border transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
              {category.sampleImage?.imageUrl ? (
                <div className="aspect-[3/4] relative">
                  <Image
                    src={category.sampleImage.imageUrl}
                    alt={category.name}
                    fill
                    unoptimized
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {category.imageCount != null && (
                    <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                      {category.imageCount >= 1000
                        ? `${(category.imageCount / 1000).toFixed(1)}k`
                        : category.imageCount}
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-[3/4] bg-muted flex items-center justify-center">
                  <span className="text-muted-foreground text-xs">No image</span>
                </div>
              )}
              <div className="p-2 text-center bg-card">
                <h3 className="text-xs font-semibold truncate group-hover:text-pink-500 transition-colors">
                  {category.name}
                </h3>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
