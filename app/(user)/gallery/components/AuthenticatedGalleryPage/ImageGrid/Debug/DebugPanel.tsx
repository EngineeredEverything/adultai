import { SearchImagesResponseSuccessType } from "@/types/images";

export const DebugPanel = ({
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
  return (
    <div
      style={{
        position: "fixed",
        top: "10px",
        right: "10px",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        color: "white",
        padding: "10px",
        borderRadius: "5px",
        zIndex: 2000,
        fontSize: "12px",
        maxWidth: "300px",
        maxHeight: "80vh",
        overflow: "auto",
      }}
    >
      <h3 style={{ margin: "0 0 5px 0" }}>Debug Info</h3>
      <div>
        <strong>Container:</strong> {containerWidth}px × {containerHeight}px
      </div>
      <div>
        <strong>Item Width:</strong> {Math.round(itemWidth)}px
      </div>
      <div>
        <strong>Gap:</strong> {GAP}px
      </div>
      <div>
        <strong>Columns:</strong> {calculateLayout(containerWidth).columns}
      </div>
      <div>
        <strong>Items:</strong> {positions.length} ({tempImages} placeholders,{" "}
        {images.length} images)
      </div>
      <div>
        <strong>Calculation Time:</strong>{" "}
        {debugInfo.calculationTime.toFixed(2)}ms
      </div>
      {debugInfo.batchGap !== null && (
        <div style={{ color: debugInfo.batchGap > 0 ? "yellow" : "lime" }}>
          <strong>Batch Gap:</strong> {debugInfo.batchGap}px
        </div>
      )}
      <div>
        <strong>Column Heights:</strong>
        <div style={{ display: "flex", marginTop: "5px" }}>
          {debugInfo.columnHeights.map((height, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                textAlign: "center",
                backgroundColor: `rgba(0, ${255 - (height / containerHeight) * 255}, ${(height / containerHeight) * 255}, 0.5)`,
                padding: "3px 0",
                margin: "0 1px",
                borderRadius: "2px",
              }}
            >
              {Math.round(height)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
