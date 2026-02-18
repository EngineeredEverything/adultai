import { SearchImagesResponseSuccessType } from "@/types/images";

export const DebugGrid = ({
  calculateLayout,
  containerWidth,
  itemWidth,
  containerHeight,
  debugInfo,
  tempImages,
  positions,
  images,
  GAP,
}: {
  positions: {
    x: number;
    y: number;
    height: number;
  }[];
  calculateLayout: (width: number) => {
    columns: number;
    itemWidth: number;
  };
  containerWidth: number;
  itemWidth: number;
  containerHeight: number;
  debugInfo: {
    columnHeights: number[];
    batchGap: number | null;
    calculationTime: number;
  };
  tempImages: number;
  images: SearchImagesResponseSuccessType["images"];
  GAP: number;
}) => {
  const { columns } = calculateLayout(containerWidth);
  const gridLines = [];

  // Create vertical grid lines
  for (let i = 0; i <= columns; i++) {
    const x = i * (itemWidth + GAP);
    gridLines.push(
      <div
        key={`vertical-${i}`}
        style={{
          position: "absolute",
          top: 0,
          left: `${x}px`,
          width: "1px",
          height: `${containerHeight}px`,
          backgroundColor: "rgba(255, 0, 0, 0.3)",
          zIndex: 1000,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "5px",
            backgroundColor: "rgba(255, 0, 0, 0.1)",
            padding: "2px 4px",
            borderRadius: "2px",
            fontSize: "10px",
          }}
        >
          {i}
        </span>
      </div>
    );
  }

  // Create horizontal markers every 100px
  for (let i = 0; i <= Math.floor(containerHeight / 100); i++) {
    const y = i * 100;
    gridLines.push(
      <div
        key={`horizontal-${i}`}
        style={{
          position: "absolute",
          top: `${y}px`,
          left: 0,
          width: `${containerWidth}px`,
          height: "1px",
          backgroundColor: "rgba(0, 0, 255, 0.3)",
          zIndex: 1000,
        }}
      >
        <span
          style={{
            position: "absolute",
            left: "5px",
            top: "-15px",
            backgroundColor: "rgba(0, 0, 255, 0.1)",
            padding: "2px 4px",
            borderRadius: "2px",
            fontSize: "10px",
          }}
        >
          {y}px
        </span>
      </div>
    );
  }

  // Highlight the gap between batches if it exists
  if (debugInfo.batchGap !== null && debugInfo.batchGap !== 0) {
    const placeholderCount = tempImages;
    if (placeholderCount > 0 && positions.length > placeholderCount) {
      const lastPlaceholderBottom =
        positions[placeholderCount - 1].y +
        positions[placeholderCount - 1].height +
        GAP;
      const firstImageTop = positions[placeholderCount].y;

      gridLines.push(
        <div
          key="gap-highlight"
          style={{
            position: "absolute",
            top: `${lastPlaceholderBottom}px`,
            left: 0,
            width: `${containerWidth}px`,
            height: `${firstImageTop - lastPlaceholderBottom}px`,
            backgroundColor: "rgba(255, 255, 0, 0.3)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              backgroundColor: "rgba(255, 255, 0, 0.7)",
              padding: "2px 4px",
              borderRadius: "2px",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            GAP: {Math.round(firstImageTop - lastPlaceholderBottom)}px
          </span>
        </div>
      );
    }
  }

  return <>{gridLines}</>;
};
