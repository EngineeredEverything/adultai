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
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import {
  Zap,
  Thermometer,
  Gauge,
  Clock,
  Fan,
  Activity,
  Database,
} from "lucide-react";
import { SystemData } from "./hook/use-system-monitoring";

interface GpuDetailedMetricsProps {
  data: SystemData;
}

export function GpuDetailedMetrics({ data }: GpuDetailedMetricsProps) {
  const primaryGpu = data.gpu_data?.nvidia_smi?.gpus?.[0];

  if (!primaryGpu) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">No GPU Details Available</h3>
            <p className="text-muted-foreground">
              Detailed GPU metrics not found
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const temperatureData = [
    {
      name: "Temperature",
      value: primaryGpu.temperature,
      fill:
        primaryGpu.temperature > 80
          ? "#ef4444"
          : primaryGpu.temperature > 60
          ? "#f59e0b"
          : "#22c55e",
    },
  ];

  const clockData = [
    {
      name: "Graphics",
      value: primaryGpu.clock_graphics_mhz,
      color: "#3b82f6",
    },
    {
      name: "Memory",
      value: primaryGpu.clock_memory_mhz,
      color: "#8b5cf6",
    },
  ];

  const powerEfficiency =
    (primaryGpu.utilization_gpu /
      100 /
      (primaryGpu.power_draw_w / primaryGpu.power_limit_w)) *
    100;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* GPU Temperature and Power */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="h-5 w-5" />
            Temperature & Power
          </CardTitle>
          <CardDescription>
            Thermal and power consumption metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Thermometer className="h-4 w-4" />
                <span className="text-sm font-medium">Temperature</span>
              </div>
              <div className="text-2xl font-bold">
                {primaryGpu.temperature}°C
              </div>
              <Progress
                value={(primaryGpu.temperature / 90) * 100}
                className="mt-2 h-2"
              />
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap className="h-4 w-4" />
                <span className="text-sm font-medium">Power Draw</span>
              </div>
              <div className="text-2xl font-bold">
                {primaryGpu.power_draw_w}W
              </div>
              <Progress
                value={
                  (primaryGpu.power_draw_w / primaryGpu.power_limit_w) * 100
                }
                className="mt-2 h-2"
              />
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="80%"
              data={temperatureData}
              startAngle={90}
              endAngle={450}
            >
              <RadialBar
                dataKey="value"
                cornerRadius={10}
                fill={temperatureData[0].fill}
              />
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-2xl font-bold"
              >
                {primaryGpu.temperature}°C
              </text>
            </RadialBarChart>
          </ResponsiveContainer>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-semibold">{primaryGpu.fan_speed}%</div>
              <div className="text-muted-foreground flex items-center justify-center gap-1">
                <Fan className="h-3 w-3" />
                Fan Speed
              </div>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-semibold">{powerEfficiency.toFixed(1)}%</div>
              <div className="text-muted-foreground flex items-center justify-center gap-1">
                <Activity className="h-3 w-3" />
                Efficiency
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clock Speeds and Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Clock Speeds & Performance
          </CardTitle>
          <CardDescription>GPU and memory clock frequencies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Gauge className="h-4 w-4" />
                <span className="text-sm font-medium">GPU Usage</span>
              </div>
              <div className="text-2xl font-bold">
                {primaryGpu.utilization_gpu}%
              </div>
              <Progress
                value={primaryGpu.utilization_gpu}
                className="mt-2 h-2"
              />
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Database className="h-4 w-4" />
                <span className="text-sm font-medium">Memory Usage</span>
              </div>
              <div className="text-2xl font-bold">
                {primaryGpu.utilization_memory}%
              </div>
              <Progress
                value={primaryGpu.utilization_memory}
                className="mt-2 h-2"
              />
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={clockData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [`${Number(value)} MHz`, ""]} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {clockData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-semibold">
                {(primaryGpu.memory_used_mb / 1024).toFixed(1)} GB
              </div>
              <div className="text-muted-foreground">Memory Used</div>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-semibold">
                {(primaryGpu.memory_total_mb / 1024).toFixed(1)} GB
              </div>
              <div className="text-muted-foreground">Total Memory</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
