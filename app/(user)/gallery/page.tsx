import AuthenticatedGalleryPage from "./components/AuthenticatedGalleryPage";
import { Metadata } from "next";
import { searchImages } from "@/actions/images/info";

// ISR: revalidate public gallery every 30 seconds
// NOTE: Do NOT call currentUser() here — session reads force Cache-Control: private
// and prevent Cloudflare from caching the page. userId is resolved client-side.
export const revalidate = 30;

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

// Prefetch public images server-side for instant paint — no auth reads
export default async function page(props: PageProps) {
  const searchParams = await props.searchParams;
  const searchQuery =
    typeof searchParams.search === "string" ? searchParams.search : "";

  // Prefetch first page server-side — images only, no votes/comments (keeps HTML small)
  const prefetched = await searchImages({
    query: searchQuery,
    filters: { isPublic: true },
    data: {
      limit: { start: 0, end: 20 },
      images: { categories: false },
      count: true,
    },
  });

  const prefetchedImages = !("error" in prefetched) ? prefetched.images : [];
  const prefetchedCount = !("error" in prefetched) ? (prefetched.count ?? 0) : 0;

  // userId is intentionally NOT passed from SSR — resolved client-side via getCurrentUserInfo()
  // This keeps the page HTML cacheable by Cloudflare (no session cookies in SSR = public cache headers)
  return (
    <AuthenticatedGalleryPage
      searchQuery={searchQuery}
      prefetchedImages={prefetchedImages}
      prefetchedCount={prefetchedCount}
    />
  );
}
