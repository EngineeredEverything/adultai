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
  Users,
  Images,
  TrendingUp,
  AlertTriangle,
  Eye,
  Flag,
  ImageIcon,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import SystemMonitoringSection from "./system-monitoring/system-monitoring-section";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import Link from "next/link";

type StatsEntry = {
  name: string;
  users: number;
  images: number;
  reports: number;
};
type CategoryEntry = { name: string; value: number; color: string };
type RecentImageEntry = {
  id: string;
  prompt: string;
  category: string;
  user: string;
  status: string;
  views: number;
  link: string | null;
  width: number | null;
  height: number | null;
};
export default function DashboardOverview({
  statsData,
  categoryData,
  recentImages,
  counts,
}: {
  statsData: StatsEntry[];
  categoryData: CategoryEntry[];
  recentImages: RecentImageEntry[];
  counts: {
    users: number;
    images: number;
    reports: number;
    deltas: {
      users: {
        day: number;
        month: number;
      };
      images: {
        day: number;
        month: number;
      };
      reports: {
        day: number;
      };
    };
  };
}) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href={"/admin/users"} className="no-underline">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {counts.users.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {counts.deltas.users.month > 0 ? "+" : ""}
                {counts.deltas.users.month}% from last month
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href={"/admin/images"} className="no-underline">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Images Generated
              </CardTitle>
              <Images className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {counts.images.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {counts.deltas.images.month > 0 ? "+" : ""}
                {counts.deltas.images.month}% from last month
              </p>
            </CardContent>
          </Card>
        </Link>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,847</div>
            <p className="text-xs text-muted-foreground">+7% from yesterday</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Reports
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {counts.reports.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {counts.deltas.reports.day > 0 ? "+" : ""}
              {counts.deltas.reports.day} from yesterday
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Growth & Image Generation</CardTitle>
            <CardDescription>
              Monthly trends over the last 6 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={statsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="images"
                  stroke="#06B6D4"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Image Categories</CardTitle>
            <CardDescription>
              Distribution of generated images by category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      {/* Recent Images Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Images</CardTitle>
          <CardDescription>
            Latest generated images requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentImages.map((image) => {
              const ratio =
                image.width && image.height && image.height !== 0
                  ? image.width / image.height
                  : 1; // default square

              return (
                <div
                  key={image.id}
                  className="flex items-center justify-between gap-4 p-4 border rounded-lg"
                >
                  {/* Thumbnail */}
                  <div className="shrink-0">
                    <div className="w-16 sm:w-20">
                      <AspectRatio ratio={ratio}>
                        {image.link ? (
                          <Image
                            src={image.link}
                            alt={image.prompt}
                            fill
                            sizes="80px"
                            className="rounded-md object-cover"
                            onLoadingComplete={() => {}}
                          />
                        ) : (
                          <div className="w-full h-full rounded-md border flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </AspectRatio>
                    </div>
                  </div>

                  {/* Text & meta */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{image.prompt}</h4>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="truncate">by @{image.user}</span>
                      <Badge variant="outline" className="whitespace-nowrap">
                        {image.category}
                      </Badge>
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <Eye className="h-3 w-3" />
                        {image.views}
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        image.status === "approved"
                          ? "default"
                          : image.status === "pending"
                          ? "secondary"
                          : "destructive"
                      }
                      className="capitalize"
                    >
                      {image.status}
                    </Badge>
                    {image.status === "flagged" && (
                      <Flag className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
