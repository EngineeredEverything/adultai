import { currentUser } from "@/utils/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { logger } from "@/lib/logger";
import AuthenticatedGalleryPage from "../components/AuthenticatedGalleryPage";
import { searchImages } from "@/actions/images/info";

export const metadata: Metadata = {
  title: {
    template: "%s | AdultAI - AI Image Gallery",
    default: "AdultAI - Explore AI-Generated Images",
    absolute: "AdultAI - Discover and Interact with AI Art",
  },
  description:
    "AdultAI's Image Gallery is a curated space for exploring AI-generated art. Browse, like, and comment on unique creations crafted with advanced AI models. Perfect for art enthusiasts and creators alike.",
  keywords: [
    // Base keywords
    "AI",
    "Image Generation",
    "Art",
    "AdultAI",
    "AI Art",
    "Digital Creation",

    // Specific features
    "AI Image Gallery",
    "AdultAI Gallery",
    "Explore AI Art",
    "AI-Generated Images",
    "Art Community",
    "Interactive Gallery",
    "Likes and Comments",
    "AI Art Platform",
  ],
};

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  params: Promise<{ category_name: string }>;
}

export default async function CategoryGalleryPage(props: PageProps) {
  // Fetch user but don't redirect — category gallery is public, voting requires auth
  const user = await currentUser();

  const params = await props.params;
  const { category_name } = params;
  const searchParams = await props.searchParams;
  const searchQuery =
    typeof searchParams.search === "string" ? searchParams.search : "";

  logger.info("category_name", category_name);

  // Validate category exists
  const category = await db.category.findFirst({
    where: {
      name: {
        equals: category_name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (!category) {
    return notFound();
  }

  // Prefetch first page server-side, sorted by votes
  const prefetched = await searchImages({
    filters: { category_id: category.id, isPublic: true, sort: "votes_desc" },
    data: {
      limit: { start: 0, end: 20 },
      images: { comments: { count: true }, categories: true, votes: { count: true } },
      count: true,
    },
  });

  const prefetchedImages = !("error" in prefetched) ? prefetched.images : [];
  const prefetchedCount = !("error" in prefetched) ? (prefetched.count ?? 0) : 0;

  return (
    <AuthenticatedGalleryPage
      userId={user?.id}
      category_id={category.id}
      searchQuery={searchQuery}
      prefetchedImages={prefetchedImages}
      prefetchedCount={prefetchedCount}
    />
  );
}
