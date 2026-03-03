export const dynamic = "force-dynamic";
import { Metadata } from 'next';
import { Suspense } from "react";
import AuthenticatedGalleryPage from "./components/AuthenticatedGalleryPage";
import { searchImages } from "@/actions/images/info";

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

// SSR prefetch — runs on the server while HTML is being streamed.
// The client skips the initial fetch when it receives prefetched data,
// eliminating one full client-server round-trip before images appear.
async function GalleryLoader() {
  try {
    const result = await searchImages({
      query: "",
      data: {
        limit: { start: 0, end: 20 },
        images: {
          votes: { count: true },
        },
        count: true,
      },
      filters: {
        isPublic: true,
        sort: "newest",
      },
    });

    const prefetchedImages = "error" in result ? [] : result.images;
    const prefetchedCount = "error" in result ? 0 : (result.count ?? 0);

    return (
      <AuthenticatedGalleryPage
        searchQuery=""
        prefetchedImages={prefetchedImages}
        prefetchedCount={prefetchedCount}
      />
    );
  } catch {
    // Fallback to client-side fetch if SSR fails
    return (
      <AuthenticatedGalleryPage
        searchQuery=""
        prefetchedImages={[]}
        prefetchedCount={0}
      />
    );
  }
}

export default function GalleryPageServer() {
  return (
    <Suspense fallback={null}>
      <GalleryLoader />
    </Suspense>
  );
}
