"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { HardDrive, MemoryStick } from "lucide-react";
import { SystemData } from "./hook/use-system-monitoring";

interface MemoryStorageChartsProps {
  data: SystemData;
}

export function MemoryStorageCharts({ data }: MemoryStorageChartsProps) {
  // Storage data
  const storageData = [
    {
      name: "Used",
      value: data.storage.used_gb,
      color: "#ef4444",
    },
    {
      name: "Free",
      value: data.storage.free_gb,
      color: "#22c55e",
    },
  ];

  // Enhanced memory data with new structure
  const memoryData = [
    {
      name: "RAM Process",
      value: data.memory.ram_process_mb / 1024,
      color: "#3b82f6",
    },
    {
      name: "GPU Allocated",
      value: data.gpu_info.allocated_gb,
      color: "#8b5cf6",
    },
    {
      name: "GPU Cached",
      value: data.gpu_info.cached_gb,
      color: "#06b6d4",
    },
    {
      name: "GPU Free",
      value: data.gpu_info.free_gb,
      color: "#22c55e",
    },
  ];

  const storageUsagePercent =
    (data.storage.used_gb / data.storage.total_gb) * 100;
  const gpuUsagePercent = data.gpu_info.utilization_percent;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Storage Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Usage
          </CardTitle>
          <CardDescription>
            {data.storage.used_gb.toFixed(1)} GB used of {data.storage.total_gb}{" "}
            GB total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Used Space</span>
              <span>{storageUsagePercent.toFixed(1)}%</span>
            </div>
            <Progress value={storageUsagePercent} className="h-3" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={storageData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {storageData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)} GB`, ""]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Enhanced Memory Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MemoryStick className="h-5 w-5" />
            Memory Usage
          </CardTitle>
          <CardDescription>RAM and GPU memory utilization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>GPU Utilization</span>
                <span>{gpuUsagePercent.toFixed(1)}%</span>
              </div>
              <Progress value={gpuUsagePercent} className="h-2" />
            </div>
            <div className="text-xs text-muted-foreground">
              GPU: {data.gpu_info.allocated_gb.toFixed(1)} GB allocated of{" "}
              {data.gpu_info.total_gb.toFixed(1)} GB total
            </div>
            <div className="text-xs text-muted-foreground">
              Safety threshold: {data.gpu_info.safety_threshold_gb.toFixed(1)}{" "}
              GB
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={memoryData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(2)} GB`, ""]}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {memoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
