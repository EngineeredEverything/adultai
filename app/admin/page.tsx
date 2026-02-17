// app/admin/page.tsx or wherever your AdminDashboard lives
import { db } from "@/lib/db";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import DashboardOverview from "./_components/dashboard-overview";

export default async function AdminDashboard() {
  // Get stats data for the chart
  // 6 months back from now
  const months = Array.from({ length: 6 }, (_, i) =>
    subMonths(new Date(), 5 - i)
  );

  const transformedStats = await Promise.all(
    months.map(async (date) => {
      const start = startOfMonth(date);
      const end = endOfMonth(date);

      const [imageCount, uniqueUsers, reportCount] = await Promise.all([
        db.generatedImage.count({
          where: {
            createdAt: { gte: start, lte: end },
          },
        }),
        db.generatedImage.groupBy({
          by: ["userId"],
          where: {
            createdAt: { gte: start, lte: end },
          },
        }),
        db.generatedImage.count({
          where: {
            createdAt: { gte: start, lte: end },
            status: "flagged",
          },
        }),
      ]);

      return {
        name: start.toLocaleString("default", { month: "short" }), // e.g., "Jan"
        users: uniqueUsers.length,
        images: imageCount,
        reports: reportCount,
      };
    })
  );

  // Get categories with counts
  const categories = await db.category.findMany({
    include: {
      _count: {
        select: { generatedImages: true },
      },
    },
    orderBy: {
      generatedImages: {
        _count: "desc",
      },
    },
    take: 5,
  });

  // Get recent generated images
  const recentImages = await db.generatedImage.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      prompt: true,
      imageUrl: true,
      width: true,
      height: true,
      status: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      categories: {
        select: {
          name: true,
        },
      },
    },
  });

  const palette = [
    "#6366F1",
    "#06B6D4",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#E879F9",
    "#3B82F6",
    "#F43F5E",
    "#8B5CF6",
    "#14B8A6",
  ];

  const categoryData = categories.map((category, index) => ({
    name: category.name,
    value: category._count.generatedImages,
    color: palette[index % palette.length], // Loop through the palette
  }));

  const transformedImages = recentImages.map((img) => ({
    id: img.id,
    prompt: img.prompt,
    category: img.categories[0]?.name ?? "Uncategorized",
    user: img.user.name ?? img.user.email,
    status: img.status,
    views: 0, // Replace if you track views
    link: img.imageUrl,
    width: img.width,
    height: img.height,
  }));

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const lastMonth = new Date(now);
  lastMonth.setMonth(now.getMonth() - 1);

  // Optional: Normalize time (00:00:00) to avoid overlap issues
  yesterday.setHours(0, 0, 0, 0);
  lastMonth.setHours(0, 0, 0, 0);

  // Fetch current & past counts
  const [
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
    db.user.count(),
    db.generatedImage.count(),
    db.generatedImage.count({ where: { status: "flagged" } }),

    db.user.count({
      where: {
        createdAt: {
          gte: lastMonth,
          lt: now,
        },
      },
    }),
    db.generatedImage.count({
      where: {
        createdAt: {
          gte: lastMonth,
          lt: now,
        },
      },
    }),
    db.generatedImage.count({
      where: {
        status: "flagged",
        createdAt: {
          gte: yesterday,
          lt: now,
        },
      },
    }),
    db.generatedImage.count({
      where: {
        status: "flagged",
        createdAt: {
          gte: new Date(yesterday.getTime() - 86400000),
          lt: yesterday,
        },
      },
    }),
    db.user.count({
      where: {
        createdAt: {
          gte: yesterday,
          lt: now,
        },
      },
    }),
    db.user.count({
      where: {
        createdAt: {
          gte: new Date(yesterday.getTime() - 86400000),
          lt: yesterday,
        },
      },
    }),
    db.generatedImage.count({
      where: {
        createdAt: {
          gte: yesterday,
          lt: now,
        },
      },
    }),
    db.generatedImage.count({
      where: {
        createdAt: {
          gte: new Date(yesterday.getTime() - 86400000),
          lt: yesterday,
        },
      },
    }),
  ]);
  function getPercentChange(current: number, previous: number) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  const stats = {
    users: {
      total: totalUsers,
      changeFromYesterday: getPercentChange(
        usersYesterday,
        usersDayBeforeYesterday
      ),
      changeFromLastMonth: getPercentChange(totalUsers, usersLastMonth),
    },
    images: {
      total: totalImages,
      changeFromYesterday: getPercentChange(
        imagesYesterday,
        imagesDayBeforeYesterday
      ),
      changeFromLastMonth: getPercentChange(totalImages, imagesLastMonth),
    },
    reports: {
      total: flaggedReports,
      changeFromYesterday: getPercentChange(
        reportsYesterday,
        reportsDayBeforeYesterday
      ),
    },
  };
  
  const counts = {
    users: stats.users.total,
    images: stats.images.total,
    reports: stats.reports.total,
    deltas: {
      users: {
        day: stats.users.changeFromYesterday,
        month: stats.users.changeFromLastMonth,
      },
      images: {
        day: stats.images.changeFromYesterday,
        month: stats.images.changeFromLastMonth,
      },
      reports: {
        day: stats.reports.changeFromYesterday,
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
