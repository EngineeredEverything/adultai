"use client";

import { ConnectionStatus } from "./connection-status";
import { SystemData, useSystemMonitoring } from "./hook/use-system-monitoring";
import SystemMonitoringSection from "./system-monitoring-section";
import { logger } from "@/lib/logger";

export default function SystemDashboard() {
  const { data, isLoading, error, isConnected, lastUpdated, refetch } =
    useSystemMonitoring({
      apiUrl: "/api/status", // Replace with your actual API endpoint
      pollingInterval: 3000, // Poll every 3 seconds
      enabled: true,
      onError: (error) => {
        console.error("System monitoring error:", error);
      },
      onSuccess: (data) => {
        logger.info("System data updated:", data.status);
      },
    });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Connection Status Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            System Dashboard
          </h1>
          <p className="text-muted-foreground">
            Real-time system monitoring and performance metrics
          </p>
        </div>
        <ConnectionStatus
          isConnected={isConnected}
          isLoading={isLoading}
          lastUpdated={lastUpdated}
          onRefresh={refetch}
        />
      </div>

      {/* System Monitoring Section */}
      <SystemMonitoringSection
        data={data}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}
