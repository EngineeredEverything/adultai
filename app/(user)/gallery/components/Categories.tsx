"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CategoriesSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6 animate-pulse">
      <div className="flex justify-between items-center mb-6">
        <div className="h-6 w-40 bg-gray-200 rounded" />
        <div className="h-5 w-32 bg-gray-200 rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="group">
            <div className="rounded-lg overflow-hidden">
              <div className="aspect-square bg-gray-200" />
              <div className="p-2 text-center">
                <div className="h-4 w-20 bg-gray-200 mx-auto rounded" />
              </div>
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
}: {
  categories: {
    id: string;
    name: string;
    keywords: string[];
    sampleImage: {
      id: string;
      imageUrl: string | null;
    } | null;
  }[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <CategoriesSkeleton />;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Top Categories</h1>
        <Link
          href="/categories"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline transition-all"
        >
          See all categories
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/gallery/${category.name.toLocaleLowerCase()}`}
            className="group"
          >
            <div className="rounded-lg overflow-hidden transition-all duration-300 hover:shadow-lg">
              {category.sampleImage ? (
                <div className="aspect-square relative">
                  <Image
                    src={category.sampleImage.imageUrl || "/placeholder.svg"}
                    alt={category.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-square bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500">No image</span>
                </div>
              )}
              <div className="p-2 text-center">
                <h3 className="text-sm font-medium truncate">
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
