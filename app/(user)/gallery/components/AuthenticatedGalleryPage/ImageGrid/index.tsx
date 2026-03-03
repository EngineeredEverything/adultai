"use client";

import type { Dispatch, SetStateAction } from "react";
import type { SearchImagesResponseSuccessType } from "@/types/images";
import type { GetCurrentUserInfoSuccessType } from "@/types/user";
import { HardDrive } from "lucide-react";
import { LoadingImageCard } from "./LoadingImageCard";
import { ImageCard } from "./ImageCard";

interface ImageGridProps {
  images: (
    | SearchImagesResponseSuccessType["images"][0]
    | { isSkeleton: boolean }
  )[];
  onImageClick: (
    image: SearchImagesResponseSuccessType["images"][number]
  ) => void;
  loadedImages: Record<string, boolean>;
  onDelete: (imageId: string) => void;
  user: GetCurrentUserInfoSuccessType | undefined;
  tempImages?: number;
  setLoadedImages: Dispatch<SetStateAction<Record<string, boolean>>>;
}

/**
 * CSS-columns masonry grid.
 * No JS layout calculation — images appear immediately on first paint.
 * Columns adjust via responsive CSS classes (1 → 2 → 3 → 4 → 5 → 6).
 */
export function ImageGrid({
  images,
  onImageClick,
  loadedImages,
  onDelete,
  user,
  tempImages = 0,
  setLoadedImages,
}: ImageGridProps) {
  const handleImageLoad = (imageId: string) => {
    setLoadedImages((prev) => ({ ...prev, [imageId]: true }));
  };

  const handleImageError = (imageId: string) => {
    setLoadedImages((prev) => ({ ...prev, [imageId]: false }));
  };

  if (!images.length && !tempImages) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <HardDrive className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500 text-lg">No images found</p>
        <p className="text-gray-400 text-sm mt-2">
          Try generating some images or changing your filters
        </p>
      </div>
    );
  }

  return (
    <div
      className="w-full"
      style={{
        columnCount: 2,
        columnGap: "12px",
      }}
      // Responsive columns via inline style (CSS custom property trick)
      // We use a style tag approach via className override below
    >
      <style>{`
        @media (min-width: 480px)  { .masonry-grid { column-count: 2; } }
        @media (min-width: 640px)  { .masonry-grid { column-count: 3; } }
        @media (min-width: 900px)  { .masonry-grid { column-count: 4; } }
        @media (min-width: 1280px) { .masonry-grid { column-count: 5; } }
        @media (min-width: 1600px) { .masonry-grid { column-count: 6; } }
        .masonry-grid * { box-sizing: border-box; }
      `}</style>

      <div
        className="masonry-grid w-full pb-12"
        style={{ columnCount: 2, columnGap: "12px" }}
      >
        {/* Loading placeholders for actively generating images */}
        {Array(tempImages)
          .fill(null)
          .map((_, index) => (
            <div key={`loading-placeholder-${index}`} style={{ breakInside: "avoid", marginBottom: "12px" }}>
              <LoadingImageCard index={index} />
            </div>
          ))}

        {/* Images */}
        {images.map((imageItem, index) => {
          // Skeleton
          if ("isSkeleton" in imageItem && imageItem.isSkeleton) {
            return (
              <div key={`skeleton-${index}`} style={{ breakInside: "avoid", marginBottom: "12px" }}>
                <LoadingImageCard index={index} skeleton />
              </div>
            );
          }

          if (!("image" in imageItem)) return null;

          if (imageItem.image.status === "processing") {
            return (
              <div key={`processing-${imageItem.image.id}`} style={{ breakInside: "avoid", marginBottom: "12px" }}>
                <LoadingImageCard index={index} />
              </div>
            );
          }

          if (imageItem.image.status === "completed") {
            return (
              <ImageCard
                key={`completed-${imageItem.image.id}`}
                image={imageItem}
                isLoaded={loadedImages[imageItem.image.id] !== false}
                onClick={() => onImageClick(imageItem)}
                onLoad={() => handleImageLoad(imageItem.image.id)}
                onError={() => handleImageError(imageItem.image.id)}
                index={index}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
