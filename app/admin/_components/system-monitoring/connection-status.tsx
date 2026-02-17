"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

interface ConnectionStatusProps {
  isConnected: boolean;
  isLoading: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

export function ConnectionStatus({
  isConnected,
  isLoading,
  lastUpdated,
  onRefresh,
}: ConnectionStatusProps) {
  const formatLastUpdated = (date: Date | null) => {
    if (!date) return "Never";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <div className="flex items-center gap-3">
      <Badge
        variant={isConnected ? "default" : "destructive"}
        className="text-sm px-3 py-1"
      >
        {isConnected ? (
          <Wifi className="w-3 h-3 mr-1" />
        ) : (
          <WifiOff className="w-3 h-3 mr-1" />
        )}
        {isConnected ? "Connected" : "Disconnected"}
      </Badge>

      <div className="text-sm text-muted-foreground">
        Last updated: {formatLastUpdated(lastUpdated)}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isLoading}
        className="h-8 bg-transparent"
      >
        <RefreshCw
          className={`w-3 h-3 mr-1 ${isLoading ? "animate-spin" : ""}`}
        />
        Refresh
      </Button>
    </div>
  );
}
