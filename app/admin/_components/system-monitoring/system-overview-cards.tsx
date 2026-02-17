"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Monitor,
  Cpu,
  Server,
  Activity,
  Zap,
  Thermometer,
  Gauge,
} from "lucide-react";
import { SystemData } from "./hook/use-system-monitoring";

interface SystemOverviewCardsProps {
  data: SystemData;
}

export function SystemOverviewCards({ data }: SystemOverviewCardsProps) {
  const primaryGpu = data.gpu_data?.nvidia_smi?.gpus?.[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Operating System
          </CardTitle>
          <Monitor className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold">{data.system_info.os}</div>
          <p className="text-xs text-muted-foreground truncate">
            {data.system_info.os_version}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">CPU Model</CardTitle>
          <Cpu className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold">{data.system_info.cpu_model}</div>
          <p className="text-xs text-muted-foreground">
            {data.system_info.cpu_cores} cores, {data.system_info.cpu_threads}{" "}
            threads
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Python Version</CardTitle>
          <Server className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold">
            {data.system_info.python_version}
          </div>
          <p className="text-xs text-muted-foreground">Runtime environment</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.cpu.usage_percent}%</div>
          <Progress value={data.cpu.usage_percent} className="mt-2" />
        </CardContent>
      </Card>

      {primaryGpu && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">GPU Model</CardTitle>
              <Gauge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{primaryGpu.name}</div>
              <p className="text-xs text-muted-foreground">
                Driver: {primaryGpu.driver_version}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                GPU Temperature
              </CardTitle>
              <Thermometer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {primaryGpu.temperature}°C
              </div>
              <Progress
                value={(primaryGpu.temperature / 90) * 100}
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                GPU Utilization
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {primaryGpu.utilization_gpu}%
              </div>
              <Progress value={primaryGpu.utilization_gpu} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Power Draw</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {primaryGpu.power_draw_w}W
              </div>
              <Progress
                value={
                  (primaryGpu.power_draw_w / primaryGpu.power_limit_w) * 100
                }
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Limit: {primaryGpu.power_limit_w}W
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
