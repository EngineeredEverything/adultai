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

// No SSR DB fetch — render shell immediately, let client load images
// This eliminates the blocking DB query that was causing slow initial loads
export default function GalleryPageServer() {
  return (
    <Suspense fallback={null}>
      <AuthenticatedGalleryPage
        searchQuery=""
        prefetchedImages={[]}
        prefetchedCount={0}
      />
    </Suspense>
  );
}
