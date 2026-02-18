"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import { Activity, AlertTriangle, TrendingUp } from "lucide-react";
import { SystemData } from "./hook/use-system-monitoring";
import { useState, useEffect } from "react";

interface GpuUsageTrendProps {
  data: SystemData;
}

interface GpuTrendData {
  timestamp: string;
  utilization: number;
  memory_utilization: number;
  temperature: number;
  power_draw: number;
  time: string;
}

export function GpuUsageTrend({ data }: GpuUsageTrendProps) {
  const [trendData, setTrendData] = useState<GpuTrendData[]>([]);
  const primaryGpu = data.gpu_data?.nvidia_smi?.gpus?.[0];

  useEffect(() => {
    if (primaryGpu) {
      const newDataPoint: GpuTrendData = {
        timestamp: new Date().toISOString(),
        utilization: primaryGpu.utilization_gpu,
        memory_utilization: primaryGpu.utilization_memory,
        temperature: primaryGpu.temperature,
        power_draw: primaryGpu.power_draw_w,
        time: new Date().toLocaleTimeString(),
      };

      setTrendData((prev) => {
        const updated = [...prev, newDataPoint];
        // Keep only last 20 data points for performance
        return updated.slice(-20);
      });
    }
  }, [primaryGpu]);

  if (!primaryGpu) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold">No GPU Data Available</h3>
            <p className="text-muted-foreground">
              GPU monitoring data not found
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentUtilization = primaryGpu.utilization_gpu;
  const isHighUsage = currentUtilization > 80;
  const isNearMaxCapacity = currentUtilization > 95;

  // Calculate peak usage from trend data
  const peakUsage = Math.max(
    ...trendData.map((d) => d.utilization),
    currentUtilization
  );
  const avgUsage =
    trendData.length > 0
      ? trendData.reduce((sum, d) => sum + d.utilization, 0) / trendData.length
      : currentUtilization;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              GPU Usage Trend
            </CardTitle>
            <CardDescription>
              Real-time GPU utilization and performance metrics
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge
              variant={
                isNearMaxCapacity
                  ? "destructive"
                  : isHighUsage
                  ? "secondary"
                  : "default"
              }
            >
              {isNearMaxCapacity
                ? "Near Max"
                : isHighUsage
                ? "High Usage"
                : "Normal"}
            </Badge>
            {peakUsage > 90 && (
              <Badge variant="outline" className="text-orange-600">
                <TrendingUp className="w-3 h-3 mr-1" />
                Peak: {peakUsage.toFixed(1)}%
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="font-semibold text-2xl text-blue-600">
              {currentUtilization}%
            </div>
            <div className="text-sm text-muted-foreground">Current Usage</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="font-semibold text-2xl text-green-600">
              {avgUsage.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Average Usage</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="font-semibold text-2xl text-orange-600">
              {peakUsage.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Peak Usage</div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={trendData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <defs>
              <linearGradient
                id="utilizationGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              label={{ value: "Usage (%)", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              formatter={(value, name) => [
                `${Number(value).toFixed(1)}%`,
                name === "utilization" ? "GPU Usage" : "Memory Usage",
              ]}
              labelFormatter={(label) => `Time: ${label}`}
            />

            {/* Reference lines for thresholds */}
            <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="5 5" />
            <ReferenceLine y={95} stroke="#ef4444" strokeDasharray="5 5" />

            <Area
              type="monotone"
              dataKey="utilization"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#utilizationGradient)"
              name="utilization"
            />
            <Line
              type="monotone"
              dataKey="memory_utilization"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              name="memory_utilization"
            />
          </AreaChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>GPU Utilization</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span>Memory Utilization</span>
          </div>
        </div>

        {isNearMaxCapacity && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-semibold">High GPU Usage Warning</span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              GPU utilization is near maximum capacity ({currentUtilization}%).
              Consider optimizing workload or scaling resources.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
