import { currentUser } from "@/utils/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AuthenticatedGalleryPage from "../components/AuthenticatedGalleryPage";

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

export default async function MyImagesPage(props: PageProps) {
  // Only check authentication on server
  const user = await currentUser();

  if (!user) {
    return redirect("/auth/login");
  }

  const searchParams = await props.searchParams;
  const searchQuery =
    typeof searchParams.search === "string" ? searchParams.search : "";

  // Pass minimal data to client component
  return (
    <AuthenticatedGalleryPage
      userId={user.id}
      userMode={true}
      searchQuery={searchQuery}
    />
  );
}
