"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Activity } from "lucide-react";
import { SystemData } from "./hook/use-system-monitoring";
import { SystemOverviewCards } from "./system-overview-cards";
import { GpuUsageTrend } from "./gpu-usage-trend";
import { MemoryStorageCharts } from "./memory-storage-charts";
import { GpuDetailedMetrics } from "./gpu-detailed-metrics";

export default function SystemMonitoringSection({
  data,
  isLoading = false,
  error = null,
}: {
  data: SystemData | null;
  isLoading?: boolean;
  error?: string | null;
}) {
  // Error handling
  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-600">
                Error Loading System Data
              </h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              System Monitoring
            </h2>
            <p className="text-muted-foreground">
              Loading system performance data...
            </p>
          </div>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            <Activity className="w-3 h-3 mr-1 animate-pulse" />
            Loading...
          </Badge>
        </div>

        {/* Loading skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <div className="p-6">
                <div className="h-4 bg-muted rounded animate-pulse mb-2" />
                <div className="h-8 bg-muted rounded animate-pulse mb-2" />
                <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Status Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            System Monitoring
          </h2>
          <p className="text-muted-foreground">
            Real-time system performance and resource utilization
          </p>
        </div>
        <Badge
          variant={data.status === "Running" ? "default" : "destructive"}
          className="text-sm px-3 py-1"
        >
          <Activity className="w-3 h-3 mr-1" />
          {data.status}
        </Badge>
      </div>

      {/* System Overview Cards */}
      <SystemOverviewCards data={data} />

      {/* GPU Usage Trend - New Feature */}
      <GpuUsageTrend data={data} />

      {/* Memory and Storage Charts */}
      <MemoryStorageCharts data={data} />

      {/* Detailed GPU Metrics */}
      <GpuDetailedMetrics data={data} />
    </div>
  );
}
