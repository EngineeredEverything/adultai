import Statistics from "../_components/statistics";
import { logger } from "@/lib/logger";

// GraphQL Response Types
interface CloudflareGraphQLResponse {
  data: {
    viewer: {
      zones: Zone[];
    };
  };
}

interface Zone {
  httpRequests1dGroups: HttpRequest1dGroup[];
}

interface HttpRequest1dGroup {
  sum: {
    requests: number;
    bytes: number;
    cachedBytes?: number;
    pageViews?: number;
    threats?: number;
  };
  uniq: {
    uniques: number;
  };
  dimensions: {
    date: string;
    clientCountryName?: string;
  };
}

// Transformed Data Types
export interface CloudflareAnalytics {
  totalRequests: number;
  uniqueVisitors: number;
  bandwidthUsed: string;
  apiCalls: number;
  deltas: {
    totalRequests: number;
    uniqueVisitors: number;
    bandwidthUsed: number;
    apiCalls: number;
  };
  trafficData: TrafficData[];
  countryData: CountryData[];
  performanceData: PerformanceData[];
}

interface TrafficData {
  date: string;
  requests: number;
  uniques: number;
  bytes: number;
}

interface CountryData {
  country: string;
  requests: number;
}

interface PerformanceData {
  metric: string;
  value: number;
  timestamp: string;
}

// Helper function to format date for API
function formatDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0];
}

// Fetch analytics data
async function fetchCloudflareAnalytics(
  apiToken: string,
  zoneId: string,
  daysBack: number = 7
): Promise<CloudflareAnalytics> {
  const startDate = formatDate(daysBack);
  logger.info(
    `Fetching Cloudflare analytics for zone ${zoneId} from ${startDate}... daysBack: ${daysBack}`
  );
  const query = `
  query {
    viewer {
      zones(filter: {zoneTag: "${zoneId}"}) {
        httpRequests1dGroups(
          limit: ${daysBack}
          filter: {
            date_gt: "${startDate}"
          }
        ) {
          sum {
            requests
            bytes
            pageViews
          }
          uniq {
            uniques
          }
          dimensions {
            date
          }
        }
      }
    }
  }`;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const json: CloudflareGraphQLResponse = await res.json();
    logger.info(json);
    if (!json.data?.viewer?.zones?.[0]?.httpRequests1dGroups) {
      throw new Error("Invalid response structure from Cloudflare API");
    }

    return transformCloudflareData(json);
  } catch (error) {
    console.error("Error fetching Cloudflare analytics:", error);
    // Return mock data as fallback
    return getMockAnalytics();
  }
}

// Transform raw data to desired format
function transformCloudflareData(
  json: CloudflareGraphQLResponse
): CloudflareAnalytics {
  const days = json.data.viewer.zones[0].httpRequests1dGroups;

  // Calculate totals
  const totalRequests = days.reduce(
    (sum: number, day: HttpRequest1dGroup) => sum + day.sum.requests,
    0
  );
  const totalUniques = days.reduce(
    (sum: number, day: HttpRequest1dGroup) => sum + day.uniq.uniques,
    0
  );
  const totalBytes = days.reduce(
    (sum: number, day: HttpRequest1dGroup) => sum + day.sum.bytes,
    0
  );

  // Sort days by date for proper delta calculation
  const sortedDays = [...days].sort(
    (a, b) =>
      new Date(a.dimensions.date).getTime() -
      new Date(b.dimensions.date).getTime()
  );

  // Calculate deltas (comparing last day vs average of previous days)
  const lastDay = sortedDays[sortedDays.length - 1];
  const previousDays = sortedDays.slice(0, -1);

  const avgPreviousRequests =
    previousDays.length > 0
      ? previousDays.reduce((sum, day) => sum + day.sum.requests, 0) /
        previousDays.length
      : 0;
  const avgPreviousUniques =
    previousDays.length > 0
      ? previousDays.reduce((sum, day) => sum + day.uniq.uniques, 0) /
        previousDays.length
      : 0;
  const avgPreviousBytes =
    previousDays.length > 0
      ? previousDays.reduce((sum, day) => sum + day.sum.bytes, 0) /
        previousDays.length
      : 0;

  const requestsDelta =
    avgPreviousRequests > 0
      ? Math.round(
          ((lastDay.sum.requests - avgPreviousRequests) / avgPreviousRequests) *
            100
        )
      : 0;
  const uniquesDelta =
    avgPreviousUniques > 0
      ? Math.round(
          ((lastDay.uniq.uniques - avgPreviousUniques) / avgPreviousUniques) *
            100
        )
      : 0;
  const bytesDelta =
    avgPreviousBytes > 0
      ? Math.round(
          ((lastDay.sum.bytes - avgPreviousBytes) / avgPreviousBytes) * 100
        )
      : 0;

  const transformed: CloudflareAnalytics = {
    totalRequests,
    uniqueVisitors: totalUniques,
    bandwidthUsed: `${(totalBytes / 1024 / 1024 / 1024 / 1024).toFixed(1)}TB`,
    apiCalls: totalRequests,
    deltas: {
      totalRequests: requestsDelta,
      uniqueVisitors: uniquesDelta,
      bandwidthUsed: bytesDelta,
      apiCalls: requestsDelta,
    },
    trafficData: days.map(
      (d: HttpRequest1dGroup): TrafficData => ({
        date: d.dimensions.date,
        requests: d.sum.requests,
        uniques: d.uniq.uniques,
        bytes: d.sum.bytes,
      })
    ),
    countryData: [],
    performanceData: [],
  };
  // logger.info("Transformed Analytics Data:", transformed);
  return transformed;
}

// Mock data fallback
function getMockAnalytics(): CloudflareAnalytics {
  return {
    totalRequests: 24841,
    uniqueVisitors: 1007,
    bandwidthUsed: "0.2TB",
    apiCalls: 24841,
    deltas: {
      totalRequests: 12,
      uniqueVisitors: 8,
      bandwidthUsed: -3,
      apiCalls: 15,
    },
    trafficData: [
      { date: "2025-07-05", requests: 2718, uniques: 179, bytes: 27729488 },
      { date: "2025-07-06", requests: 5171, uniques: 201, bytes: 32108641 },
      { date: "2025-07-07", requests: 1976, uniques: 147, bytes: 16005282 },
      { date: "2025-07-08", requests: 3737, uniques: 147, bytes: 41635888 },
      { date: "2025-07-09", requests: 3277, uniques: 116, bytes: 36624783 },
      { date: "2025-07-10", requests: 3332, uniques: 128, bytes: 35052471 },
      { date: "2025-07-11", requests: 5630, uniques: 89, bytes: 52188725 },
    ],
    countryData: [],
    performanceData: [],
  };
}
function parseSearchParams(searchParams: {
  [key: string]: string | string[] | undefined;
}) {
  const getString = (key: string): string => {
    const value = searchParams[key];
    return typeof value === "string" ? value : "";
  };

  const getNumber = (
    key: string,
    defaultValue: number,
    min = 1,
    max = Number.POSITIVE_INFINITY
  ): number => {
    const value = searchParams[key];
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      return isNaN(parsed)
        ? defaultValue
        : Math.max(min, Math.min(max, parsed));
    }
    return defaultValue;
  };

  const getStringArray = (key: string): string[] => {
    const value = searchParams[key];
    if (typeof value === "string") {
      return value.split(",").filter(Boolean);
    }
    return [];
  };

  return {
    days: getString("days"),
  };
}
export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;

  const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
  const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID!;

  // Validate environment variables
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
    console.error(
      "Missing required environment variables: CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID"
    );
    const mockData = getMockAnalytics();
    return (
      <Statistics
        analyticsData={mockData}
        searchParams={parseSearchParams(resolvedSearchParams)}
      />
    );
  }

  // Parse and fallback if needed
  const parsedParams = parseSearchParams(resolvedSearchParams);
  const days = Number(parsedParams.days) || 7;

  // Fetch analytics data
  const analyticsData = await fetchCloudflareAnalytics(
    CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ZONE_ID,
    days
  );

  return (
    <Statistics analyticsData={analyticsData} searchParams={parsedParams} />
  );
}
