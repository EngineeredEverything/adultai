import { Metadata } from "next";
import FloatingSearch from "./components/floating-search";

export const metadata: Metadata = {
  title: {
    template: '%s | AdultAI - AI Image Generation',
    default: 'AdultAI - Gallery',
    absolute: 'AdultAI - Explore Your AI-Generated Images',
  },
  description:
    'Browse and explore your AI-generated images in the AdultAI Gallery. View and manage your unique creations, crafted using advanced AI image generation technology.',
  keywords: [
    // Base keywords
    'AI',
    'Image Generation',
    'Art',
    'AdultAI',
    'AI Art',
    'Digital Creation',

    // Specific features
    'Gallery',
    'AI Gallery',
    'Image Browse',
    'AI Creations',
    'Art Collection',
    'Digital Gallery',
  ],
};
export default function GalleryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // <FloatingSearch
    //   placeholder="Search generations..."
    //   searchParamKey="search"
    //   debounceMs={500}
    //   autoSearch={true}
    //   showSearchButton={true}
    // >
      children
    // </FloatingSearch>
  );
}
