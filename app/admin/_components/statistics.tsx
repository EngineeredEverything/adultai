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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  Users,
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";
import { CloudflareAnalytics } from "@/app/admin/statistics/page";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export default function Statistics({
  analyticsData,
  searchParams,
}: {
  analyticsData: CloudflareAnalytics;
  searchParams: {
    days: string;
  };
}) {
  const router = useRouter();
  const [dayRange, setDayRange] = useState(searchParams.days || "7");

  // Optimized URL update function
  const updateSearchParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      const params = new URLSearchParams();

      Object.entries(searchParams).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, v));
        } else {
          params.append(key, value.toString());
        }
      });

      const queryString = params.toString();
      let shouldResetPage = false;

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "all" || value === "" || value === 0) {
          params.delete(key);
        } else {
          params.set(key, value.toString());
        }

        // Reset to first page when filters change (except for page and limit changes)
        if (key !== "page" && key !== "limit") {
          shouldResetPage = true;
        }
      });

      if (shouldResetPage && !updates.page) {
        params.delete("page");
      }

      // Use replace to avoid adding to history stack
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );


    const handleStatusChange = useCallback(
      (value: string) => {
        setDayRange(value);
        updateSearchParams({ days: value === "all" ? null : value });
      },
      [updateSearchParams]
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Statistics & Analytics</h1>
          <p className="text-muted-foreground">
            Real-time performance and usage analytics
          </p>
        </div>
        <Select
          defaultValue={dayRange || "7"}
          onValueChange={(value) => handleStatusChange(value)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={"1"}>Last 24 Hours</SelectItem>
            <SelectItem value={"7"}>Last 7 Days</SelectItem>
            <SelectItem value={"30"}>Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Requests
            </CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.totalRequests.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              {analyticsData.deltas.totalRequests}% from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Unique Visitors
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.uniqueVisitors.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              {analyticsData.deltas.uniqueVisitors}% from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Bandwidth Used
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.bandwidthUsed}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-500" />
              {analyticsData.deltas.bandwidthUsed}% from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Calls</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.apiCalls.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              {analyticsData.deltas.apiCalls}% from yesterday
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Traffic Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Traffic Overview</CardTitle>
          <CardDescription>
            Requests, bandwidth, and users over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={analyticsData.trafficData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="requests"
                stackId="1"
                stroke="#8B5CF6"
                fill="#8B5CF6"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="uniques"
                stackId="2"
                stroke="#06B6D4"
                fill="#06B6D4"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Geographic Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Traffic by Country</CardTitle>
            <CardDescription>Top countries by request volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData.countryData.map((country, index) => (
                <div
                  key={country.country}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-4 bg-gray-200 dark:bg-gray-700 rounded-sm flex items-center justify-center text-xs">
                      {index + 1}
                    </div>
                    <span className="font-medium">{country.country}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {country.requests.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData.performanceData.map((metric) => (
                <div
                  key={metric.metric}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{metric.metric}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">{metric.value}</span>
                    <Badge variant="secondary" className="text-xs">
                      {metric.timestamp}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bandwidth Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Bandwidth Usage</CardTitle>
          <CardDescription>
            Data transfer over the last 24 hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.trafficData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="bytes" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
