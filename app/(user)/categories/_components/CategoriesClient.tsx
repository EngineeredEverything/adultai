"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getAllCategories } from "@/actions/category/info";
import { getCurrentUserInfo } from "@/actions/user/info";
import { isGetCurrentUserInfoSuccess } from "@/types/user";
import { Spinner } from "@/components/ui/spinner";
import NavComp from "../_components/navComp";

type Category = {
  id: string;
  name: string;
  keywords: string[];
  sampleImage?: {
    imageUrl: string | null;
  } | null;
};

type UserInfo = Awaited<ReturnType<typeof getCurrentUserInfo>>;

export default function CategoriesClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [categoriesData, userData] = await Promise.all([
          getAllCategories(),
          getCurrentUserInfo({
            role: {},
            images: {},
          }),
        ]);

        setCategories(categoriesData);
        setUser(userData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">All Categories</h1>
        <p className="text-muted-foreground">
          Explore all available categories and discover content that interests
          you.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/gallery/${category.name.toLowerCase()}`}
            className="group"
          >
            <div className="rounded-lg overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-105">
              {category.sampleImage ? (
                <div className="aspect-square relative">
                  <Image
                    src={category.sampleImage.imageUrl || "/placeholder.svg"}
                    alt={category.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
              ) : (
                <div className="aspect-square bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500">No image</span>
                </div>
              )}
              <div className="p-3 text-center bg-background">
                <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                  {category.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {category.keywords.slice(0, 2).join(", ")}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No categories found.</p>
        </div>
      )}

      <NavComp user={user && isGetCurrentUserInfoSuccess(user) ? user : null} />
    </div>
  );
}
