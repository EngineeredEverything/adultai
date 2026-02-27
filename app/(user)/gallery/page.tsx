import { currentUser } from "@/utils/auth";
import AuthenticatedGalleryPage from "./components/AuthenticatedGalleryPage";
import { Metadata } from "next";
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
    "AI",
    "Image Generation",
    "Art",
    "AdultAI",
    "AI Art",
    "Digital Creation",
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
}

// <CHANGE> Simplified SSR to only handle auth check and search params
export default async function page(props: PageProps) {
  const searchParams = await props.searchParams;
  const searchQuery =
    typeof searchParams.search === "string" ? searchParams.search : "";

  const user = await currentUser();

  // Prefetch first page of images server-side to eliminate client waterfall
  const prefetched = await searchImages({
    query: searchQuery,
    filters: { isPublic: true },
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
      searchQuery={searchQuery}
      prefetchedImages={prefetchedImages}
      prefetchedCount={prefetchedCount}
    />
  );
}
