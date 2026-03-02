/**
 * Backfill script: populate thumbnailUrl for all categories
 * with the top-voted public image in each category.
 *
 * Run: node scripts/backfill-category-thumbnails.mjs
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const categories = await db.category.findMany({
    select: { id: true, name: true, imageIds: true },
  });

  console.log(`Found ${categories.length} categories to process`);

  let updated = 0;
  let skipped = 0;

  for (const category of categories) {
    if (category.imageIds.length === 0) {
      skipped++;
      continue;
    }

    const best = await db.generatedImage.findFirst({
      where: {
        categoryIds: { has: category.id },
        status: "completed",
        imageUrl: { not: null },
        isPublic: true,
      },
      select: { imageUrl: true },
      orderBy: [{ voteScore: "desc" }, { upvotes: "desc" }, { createdAt: "desc" }],
    });

    if (best?.imageUrl) {
      await db.category.update({
        where: { id: category.id },
        data: { thumbnailUrl: best.imageUrl },
      });
      console.log(`✅ ${category.name} → ${best.imageUrl.slice(0, 60)}...`);
      updated++;
    } else {
      // Try without isPublic filter (older images might not have the flag set)
      const fallback = await db.generatedImage.findFirst({
        where: {
          categoryIds: { has: category.id },
          imageUrl: { not: null },
        },
        select: { imageUrl: true },
        orderBy: [{ voteScore: "desc" }, { upvotes: "desc" }, { createdAt: "desc" }],
      });

      if (fallback?.imageUrl) {
        await db.category.update({
          where: { id: category.id },
          data: { thumbnailUrl: fallback.imageUrl },
        });
        console.log(`✅ (fallback) ${category.name} → ${fallback.imageUrl.slice(0, 60)}...`);
        updated++;
      } else {
        console.log(`⚠️  ${category.name} — no image found`);
        skipped++;
      }
    }
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
