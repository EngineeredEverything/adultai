"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Dispatch,
  SetStateAction,
} from "react";
import type { SearchImagesResponseSuccessType } from "@/types/images";
import type { User } from "next-auth";
import { HardDrive } from "lucide-react";
import { logger } from "@/lib/logger";
import { DebugGrid } from "./Debug/DebugGrid";
import { DebugPanel } from "./Debug/DebugPanel";
import { LoadingImageCard } from "./LoadingImageCard";
import { GetCurrentUserInfoSuccessType } from "@/types/user";
import { ImageCard } from "./ImageCard";

// Debug flag - set to true to enable debugging
const DEBUG = process.env.NEXT_PUBLIC_GRID_LEVEL === "debug" || false;

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

export function ImageGrid({
  images,
  onImageClick,
  loadedImages,
  onDelete,
  user,
  tempImages = 0,
  setLoadedImages,
}: ImageGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [containerHeight, setContainerHeight] = useState(0);
  const [itemWidth, setItemWidth] = useState(285.5);
  const [positions, setPositions] = useState<
    { x: number; y: number; height: number }[]
  >([]);
  const [debugInfo, setDebugInfo] = useState<{
    columnHeights: number[];
    batchGap: number | null;
    calculationTime: number;
  }>({
    columnHeights: [],
    batchGap: null,
    calculationTime: 0,
  });

  // Constants for layout calculation
  const GAP = 16;
  const MIN_COLUMNS = 1;
  const MAX_COLUMNS = 6;
  const MIN_ITEM_WIDTH = 240;

  // Calculate number of columns and item width based on container width
  const calculateLayout = (width: number) => {
    const effectiveWidth = width - GAP * 2;
    const maxPossibleColumns = Math.floor(
      (effectiveWidth + GAP) / (MIN_ITEM_WIDTH + GAP)
    );
    const columns = Math.max(
      MIN_COLUMNS,
      Math.min(maxPossibleColumns, MAX_COLUMNS)
    );
    const calculatedItemWidth =
      (effectiveWidth - (columns - 1) * GAP) / columns;

    if (DEBUG) {
      logger.info(
        `Layout calculation: width=${width}, columns=${columns}, itemWidth=${calculatedItemWidth}`
      );
    }

    return { columns, itemWidth: calculatedItemWidth };
  };

  const handleImageLoad = useCallback(
    (imageId: string) => {
      setLoadedImages((prev) => ({
        ...prev,
        [imageId]: true,
      }));
    },
    [setLoadedImages]
  );

  const handleImageError = useCallback(
    (imageId: string, error: Error) => {
      logger.error("Failed to load image:", imageId, error);
      setLoadedImages((prev) => ({
        ...prev,
        [imageId]: false,
      }));
    },
    [setLoadedImages]
  );

  // Update dimensions when container size changes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        setContainerWidth(width);

        const { columns, itemWidth } = calculateLayout(width);
        setItemWidth(itemWidth);

        if (DEBUG) {
          logger.info(
            `Container resized: width=${width}, new itemWidth=${itemWidth}`
          );
        }
      }
    };

    updateDimensions();

    // Debounce resize handler for better performance
    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateDimensions, 100);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Calculate positions for the masonry layout
  useEffect(() => {
    if (DEBUG) {
      console.group("Position calculation");
      logger.info(
        `Starting calculation: images=${images.length}, tempImages=${tempImages}`
      );
      console.time("Position calculation time");
    }

    const startTime = performance.now();
    const { columns } = calculateLayout(containerWidth);

    // Calculate positions for each item
    const columnHeights = Array(columns).fill(0);
    const newPositions: { x: number; y: number; height: number }[] = [];
    let batchGap: number | null = null;

    // Process placeholder items first
    if (DEBUG) logger.info("Processing placeholders...");

    const placeholders = Array(tempImages).fill(null);
    placeholders.forEach((_, index) => {
      const minHeightColumn = columnHeights.indexOf(Math.min(...columnHeights));
      const x = minHeightColumn * (itemWidth + GAP);
      const y = columnHeights[minHeightColumn];
      const height = itemWidth; // Square placeholders

      columnHeights[minHeightColumn] += height + GAP;
      newPositions.push({ x, y, height });

      if (DEBUG) {
        logger.info(
          `Placeholder ${index}: column=${minHeightColumn}, y=${y}, height=${height}, newColumnHeight=${columnHeights[minHeightColumn]}`
        );
      }
    });

    if (DEBUG && tempImages > 0) {
      logger.info("Column heights after placeholders:", [...columnHeights]);
    }

    // Then process actual images (including skeletons)
    if (DEBUG) logger.info("Processing images...");

    images.forEach((imageItem, index) => {
      const minHeightColumn = columnHeights.indexOf(Math.min(...columnHeights));
      const x = minHeightColumn * (itemWidth + GAP);
      const y = columnHeights[minHeightColumn];

      // Handle skeleton items
      if ("isSkeleton" in imageItem && imageItem.isSkeleton) {
        const height = itemWidth; // Square aspect ratio for skeletons
        columnHeights[minHeightColumn] += height + GAP;
        newPositions.push({ x, y, height });

        if (DEBUG) {
          logger.info(
            `Skeleton ${index}: column=${minHeightColumn}, y=${y}, height=${height}, newColumnHeight=${columnHeights[minHeightColumn]}`
          );
        }
        return;
      }

      if (index === 0 && tempImages > 0) {
        // Store the gap between batches (first image after placeholders)
        const lastPlaceholderIndex = tempImages - 1;
        if (lastPlaceholderIndex >= 0 && newPositions[lastPlaceholderIndex]) {
          const lastPlaceholderBottom =
            newPositions[lastPlaceholderIndex].y +
            newPositions[lastPlaceholderIndex].height +
            GAP;
          batchGap = y - lastPlaceholderBottom;

          if (DEBUG) {
            logger.info(`Gap between batches: ${batchGap}px`);
            logger.info(
              `Last placeholder bottom: ${lastPlaceholderBottom}, First image top: ${y}`
            );
          }
        }
      }

      let height = itemWidth; // Default square aspect ratio

      if (
        "image" in imageItem &&
        imageItem.image.status === "completed" &&
        imageItem.image.width &&
        imageItem.image.height
      ) {
        const aspectRatio = imageItem.image.width / imageItem.image.height;
        height = itemWidth / aspectRatio;
      }

      columnHeights[minHeightColumn] += height + GAP;
      newPositions.push({ x, y, height });

      if (DEBUG) {
        if ("image" in imageItem) {
          logger.info(
            `Image ${index} (${imageItem.image.id}): column=${minHeightColumn}, y=${y}, height=${height}, newColumnHeight=${columnHeights[minHeightColumn]}`
          );
        } else {
          logger.info(
            `Image ${index} (no image property): column=${minHeightColumn}, y=${y}, height=${height}, newColumnHeight=${columnHeights[minHeightColumn]}`
          );
        }
      }
    });

    setPositions(newPositions);

    // Update container height
    if (newPositions.length > 0) {
      const maxHeight = Math.max(...columnHeights);
      setContainerHeight(maxHeight);

      if (DEBUG) {
        logger.info(`New container height: ${maxHeight}px`);
      }
    } else {
      setContainerHeight(0);
    }

    const endTime = performance.now();

    // Store debug info
    setDebugInfo({
      columnHeights: [...columnHeights],
      batchGap,
      calculationTime: endTime - startTime,
    });

    if (DEBUG) {
      logger.info(
        `Calculation completed: ${newPositions.length} items positioned`
      );
      console.timeEnd("Position calculation time");
      console.groupEnd();
    }
  }, [containerWidth, itemWidth, images, tempImages]);

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
      ref={containerRef}
      className="mx-2 w-full max-w-[1793px] relative flex flex-row items-start justify-center"
      style={{
        height: `${containerHeight}px`,
        minHeight: "100dvh",
        paddingBottom: "48px",
      }}
    >
      {/* Debug Grid */}
      {DEBUG && (
        <DebugGrid
          positions={positions}
          calculateLayout={calculateLayout}
          containerWidth={containerWidth}
          itemWidth={itemWidth}
          containerHeight={containerHeight}
          debugInfo={debugInfo}
          tempImages={tempImages}
          images={images.filter(
            (img): img is Exclude<typeof img, { isSkeleton: boolean }> =>
              "image" in img
          )}
          GAP={GAP}
        />
      )}

      {/* Render loading placeholders */}
      {Array(tempImages)
        .fill(null)
        .map((_, index) => {
          const position = positions[index] || {
            x: 0,
            y: 0,
            height: itemWidth,
          };

          return (
            <LoadingImageCard
              key={`loading-placeholder-${index}`}
              index={index}
              position={position}
              width={itemWidth}
              debug={DEBUG}
            />
          );
        })}

      {/* Render actual images */}
      {images.map((imageItem, index) => {
        const positionIndex = tempImages + index;
        const position = positions[positionIndex] || {
          x: 0,
          y: 0,
          height: itemWidth,
        };

        // Handle skeleton items
        if ("isSkeleton" in imageItem && imageItem.isSkeleton) {
          return (
            <LoadingImageCard
              key={`skeleton-${positionIndex}-${index}`}
              index={positionIndex}
              position={position}
              width={itemWidth}
              debug={DEBUG}
              skeleton
            />
          );
        }

        // Existing logic for image items
        if ("image" in imageItem) {
          if (imageItem.image.status === "processing") {
            return (
              <LoadingImageCard
                key={`processing-${imageItem.image.id}-${index}`}
                index={positionIndex}
                position={position}
                width={itemWidth}
                debug={DEBUG}
              />
            );
          } else if (imageItem.image.status === "completed") {
            return (
              <ImageCard
                key={`completed-${imageItem.image.id}-${index}`}
                image={imageItem}
                isLoaded={loadedImages[imageItem.image.id] !== false}
                onClick={() => onImageClick(imageItem)}
                onLoad={() => handleImageLoad(imageItem.image.id)}
                onError={(e: Error) => handleImageError(imageItem.image.id, e)}
                position={position}
                width={itemWidth}
                debug={DEBUG}
                index={positionIndex}
              />
            );
          }
        }
        return null;
      })}

      {/* Debug Panel */}
      {DEBUG && (
        <DebugPanel
          positions={positions}
          calculateLayout={calculateLayout}
          containerWidth={containerWidth}
          itemWidth={itemWidth}
          containerHeight={containerHeight}
          debugInfo={debugInfo}
          tempImages={tempImages}
          images={images.filter(
            (img): img is Exclude<typeof img, { isSkeleton: boolean }> =>
              "image" in img
          )}
          GAP={GAP}
        />
      )}
    </div>
  );
}
