import { currentUser } from "@/utils/auth"
import AuthenticatedVideoGalleryPage from "./components/AuthenticatedVideoGalleryPage"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: {
    template: "%s | AdultAI - AI Video Gallery",
    default: "AdultAI - Explore AI-Generated Videos",
    absolute: "AdultAI - Discover and Interact with AI Videos",
  },
  description:
    "AdultAI's Video Gallery is a curated space for exploring AI-generated videos. Browse, like, and comment on unique creations crafted with advanced AI models. Perfect for video enthusiasts and creators alike.",
  keywords: [
    "AI",
    "Video Generation",
    "Art",
    "AdultAI",
    "AI Video",
    "Digital Creation",
    "AI Video Gallery",
    "AdultAI Gallery",
    "Explore AI Videos",
    "AI-Generated Videos",
    "Video Community",
    "Interactive Gallery",
    "Likes and Comments",
    "AI Video Platform",
  ],
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function page(props: PageProps) {
  const searchParams = await props.searchParams
  const searchQuery = typeof searchParams.search === "string" ? searchParams.search : ""

  const user = await currentUser()

  return <AuthenticatedVideoGalleryPage userId={user?.id} searchQuery={searchQuery} />
}
