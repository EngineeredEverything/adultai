export const dynamic = "force-static";
import { Metadata } from 'next';
import { Suspense } from "react";
import AuthenticatedGalleryPage from "./components/AuthenticatedGalleryPage";
import { searchImages } from "@/actions/images/info";

export const revalidate = 30;

export const metadata: Metadata = {
  title: {
    template: "%s | AdultAI - AI Image Gallery",
    default: "AdultAI - Explore AI-Generated Images",
    absolute: "AdultAI - Discover and Interact with AI Art",
  },
  description:
    "AdultAI's Image Gallery is a curated space for exploring AI-generated art. Browse, like, and comment on unique creations crafted with advanced AI models.",
  keywords: [
    "AI", "Image Generation", "Art", "AdultAI", "AI Art", "Digital Creation",
    "AI Image Gallery", "AdultAI Gallery", "Explore AI Art", "AI-Generated Images",
  ],
};

export async function fetchImagesSSR() {
  try {
    const prefetched = await searchImages({
      query: "",
      data: {
        limit: {
          start: 0,
          end: 20,
        },
        images: {
          comments: { count: true },
          categories: true,
          votes: { count: true },
        },
        count: true,
      },
      filters: { isPublic: true, sort: "votes_desc" },
    });
    const prefetchedImages = !("error" in prefetched) ? prefetched.images : [];
    const prefetchedCount = !("error" in prefetched) ? (prefetched.count ?? 0) : 0;

    return { prefetchedImages, prefetchedCount };
  } catch (error) {
    console.error("Failed to prefetch images for gallery:", error);
    return { prefetchedImages: [], prefetchedCount: 0 };
  }
}

export default async function GalleryPageServer() {
  const { prefetchedImages, prefetchedCount } = await fetchImagesSSR();
  return (
    <Suspense fallback={null}>
      <AuthenticatedGalleryPage
        searchQuery=""
        prefetchedImages={prefetchedImages}
        prefetchedCount={prefetchedCount}
      />
    </Suspense>
  );
}
