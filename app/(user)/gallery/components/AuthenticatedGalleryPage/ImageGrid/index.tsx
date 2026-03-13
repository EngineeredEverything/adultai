"use client";

import type { Dispatch, SetStateAction } from "react";
import type { SearchImagesResponseSuccessType } from "@/types/images";
import type { GetCurrentUserInfoSuccessType } from "@/types/user";
import { HardDrive } from "lucide-react";
import { useEffect, useState } from "react";
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

function getColumnCount(width: number): number {
  if (width >= 1600) return 6;
  if (width >= 1280) return 5;
  if (width >= 900) return 4;
  if (width >= 640) return 3;
  return 2;
}

/**
 * Flex-column masonry grid.
 * Items are distributed across N vertical flex columns (round-robin).
 * No CSS columns — no gaps, no break-inside hacks.
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
  const [colCount, setColCount] = useState(() =>
    typeof window !== "undefined" ? getColumnCount(window.innerWidth) : 2
  );

  useEffect(() => {
    const update = () => setColCount(getColumnCount(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const handleImageLoad = (imageId: string) => {
    setLoadedImages((prev) => ({ ...prev, [imageId]: true }));
  };

  const handleImageError = (imageId: string) => {
    setLoadedImages((prev) => ({ ...prev, [imageId]: false }));
  };

  // Build flat list of all renderable items
  type Item =
    | { kind: "placeholder"; idx: number }
    | { kind: "skeleton"; idx: number }
    | { kind: "processing"; idx: number; id: string }
    | { kind: "image"; idx: number; item: SearchImagesResponseSuccessType["images"][number] };

  const items: Item[] = [];

  for (let i = 0; i < tempImages; i++) {
    items.push({ kind: "placeholder", idx: i });
  }

  images.forEach((imageItem, index) => {
    if ("isSkeleton" in imageItem && imageItem.isSkeleton) {
      items.push({ kind: "skeleton", idx: index });
      return;
    }
    if (!("image" in imageItem)) return;
    if (imageItem.image.status === "processing") {
      items.push({ kind: "processing", idx: index, id: imageItem.image.id });
      return;
    }
    if (imageItem.image.status === "completed") {
      items.push({ kind: "image", idx: index, item: imageItem });
    }
  });

  if (!items.length) {
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

  // Distribute items to shortest column first (by estimated height)
  const columns: Item[][] = Array.from({ length: colCount }, () => []);
  const colHeights: number[] = new Array(colCount).fill(0);

  function estimateHeight(item: Item): number {
    if (item.kind === "image") {
      const w = Number(item.item.image.width) || 512;
      const h = Number(item.item.image.height) || 768;
      return h / w; // aspect ratio as relative height
    }
    return 1.5; // default portrait ratio for placeholders/skeletons
  }

  items.forEach((item) => {
    // Find the shortest column
    let minIdx = 0;
    for (let c = 1; c < colCount; c++) {
      if (colHeights[c] < colHeights[minIdx]) minIdx = c;
    }
    columns[minIdx].push(item);
    colHeights[minIdx] += estimateHeight(item);
  });

  return (
    <div className="flex gap-3 w-full pb-12 items-start align-top">
      {columns.map((col, colIdx) => (
        <div key={colIdx} className="flex flex-col gap-3 flex-1 min-w-0 self-start">
          {col.map((item) => {
            if (item.kind === "placeholder") {
              return <LoadingImageCard key={`placeholder-${item.idx}`} index={item.idx} />;
            }
            if (item.kind === "skeleton") {
              return <LoadingImageCard key={`skeleton-${item.idx}`} index={item.idx} skeleton />;
            }
            if (item.kind === "processing") {
              return <LoadingImageCard key={`processing-${item.id}`} index={item.idx} />;
            }
            if (item.kind === "image") {
              return (
                <ImageCard
                  key={`image-${item.item.image.id}`}
                  image={item.item}
                  isLoaded={loadedImages[item.item.image.id] !== false}
                  onClick={() => onImageClick(item.item)}
                  onLoad={() => handleImageLoad(item.item.image.id)}
                  onError={() => handleImageError(item.item.image.id)}
                  onDelete={onDelete}
                  user={user}
                  index={item.idx}
                />
              );
            }
            return null;
          })}
        </div>
      ))}
    </div>
  );
}
