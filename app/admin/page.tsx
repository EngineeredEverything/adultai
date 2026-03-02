export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import dynamic from "next/dynamic";

const DashboardOverview = dynamic(() => import("./_components/dashboard-overview"));

export default async function AdminDashboard() {
  const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));

  const [
    transformedStats,
    categories,
    recentImages,
    totalUsers,
    totalImages,
    flaggedReports,
    usersLastMonth,
    imagesLastMonth,
    reportsYesterday,
    reportsDayBeforeYesterday,
    usersYesterday,
    usersDayBeforeYesterday,
    imagesYesterday,
    imagesDayBeforeYesterday,
  ] = await Promise.all([
    // Monthly stats
    Promise.all(
      months.map(async (date) => {
        const start = startOfMonth(date);
        const end = endOfMonth(date);
        const [imageCount, uniqueUsers, reportCount] = await Promise.all([
          db.generatedImage.count({ where: { createdAt: { gte: start, lte: end } } }),
          db.generatedImage.groupBy({ by: ["userId"], where: { createdAt: { gte: start, lte: end } } }),
          db.generatedImage.count({ where: { createdAt: { gte: start, lte: end }, status: "flagged" } }),
        ]);
        return {
          name: start.toLocaleString("default", { month: "short" }),
          users: uniqueUsers.length,
          images: imageCount,
          reports: reportCount,
        };
      })
    ),
    // Top categories
    db.category.findMany({
      include: { _count: { select: { generatedImages: true } } },
      orderBy: { generatedImages: { _count: "desc" } },
      take: 5,
    }),
    // Recent images
    db.generatedImage.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true, prompt: true, imageUrl: true, width: true, height: true, status: true,
        user: { select: { name: true, email: true } },
        categories: { select: { name: true } },
      },
    }),
    // Counts
    db.user.count(),
    db.generatedImage.count(),
    db.generatedImage.count({ where: { status: "flagged" } }),
    db.user.count({ where: { createdAt: { gte: (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); d.setHours(0,0,0,0); return d; })(), lt: new Date() } } }),
    db.generatedImage.count({ where: { createdAt: { gte: (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); d.setHours(0,0,0,0); return d; })(), lt: new Date() } } }),
    db.generatedImage.count({ where: { status: "flagged", createdAt: { gte: (() => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0,0,0,0); return d; })(), lt: new Date() } } }),
    db.generatedImage.count({ where: { status: "flagged", createdAt: { gte: (() => { const d = new Date(); d.setDate(d.getDate() - 2); d.setHours(0,0,0,0); return d; })(), lt: (() => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0,0,0,0); return d; })() } } }),
    db.user.count({ where: { createdAt: { gte: (() => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0,0,0,0); return d; })(), lt: new Date() } } }),
    db.user.count({ where: { createdAt: { gte: (() => { const d = new Date(); d.setDate(d.getDate() - 2); d.setHours(0,0,0,0); return d; })(), lt: (() => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0,0,0,0); return d; })() } } }),
    db.generatedImage.count({ where: { createdAt: { gte: (() => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0,0,0,0); return d; })(), lt: new Date() } } }),
    db.generatedImage.count({ where: { createdAt: { gte: (() => { const d = new Date(); d.setDate(d.getDate() - 2); d.setHours(0,0,0,0); return d; })(), lt: (() => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(0,0,0,0); return d; })() } } }),
  ]);

  const palette = ["#6366F1","#06B6D4","#10B981","#F59E0B","#EF4444","#E879F9","#3B82F6","#F43F5E","#8B5CF6","#14B8A6"];

  const categoryData = categories.map((cat, i) => ({
    name: cat.name,
    value: cat._count.generatedImages,
    color: palette[i % palette.length],
  }));

  const transformedImages = recentImages.map((img) => ({
    id: img.id,
    prompt: img.prompt,
    category: img.categories[0]?.name ?? "Uncategorized",
    user: img.user.name ?? img.user.email,
    status: img.status,
    views: 0,
    link: img.imageUrl,
    width: img.width,
    height: img.height,
  }));

  function getPercentChange(current: number, previous: number) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  const counts = {
    users: totalUsers,
    images: totalImages,
    reports: flaggedReports,
    deltas: {
      users: {
        day: getPercentChange(usersYesterday, usersDayBeforeYesterday),
        month: getPercentChange(totalUsers, usersLastMonth),
      },
      images: {
        day: getPercentChange(imagesYesterday, imagesDayBeforeYesterday),
        month: getPercentChange(totalImages, imagesLastMonth),
      },
      reports: {
        day: getPercentChange(reportsYesterday, reportsDayBeforeYesterday),
      },
    },
  };

  return (
    <DashboardOverview
      statsData={transformedStats}
      categoryData={categoryData}
      recentImages={transformedImages}
      counts={counts}
    />
  );
}
