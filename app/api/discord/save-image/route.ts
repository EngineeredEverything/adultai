import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import crypto from "crypto";
import { analyzePromptForCategory } from "@/lib/category-analyzer";

const BOT_SECRET = process.env.DISCORD_BOT_SECRET || "adultai_discord_bot_2026";

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const botSecret = headersList.get("x-bot-secret");
    if (botSecret !== BOT_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { discordId, discordUsername, imageUrl, prompt, isPublic, width, height, categoryName } = body;

    if (!discordId || !imageUrl) {
      return NextResponse.json({ error: "Missing discordId or imageUrl" }, { status: 400 });
    }

    let userId: string | null = null;
    let isNewUser = false;

    // Scenario 1: Discord already linked to an account
    const existingAccount = await db.account.findFirst({
      where: { provider: "discord", providerAccountId: discordId },
    });

    if (existingAccount) {
      userId = existingAccount.userId;
    }

    // Scenario 2: No link — create orphan account + pending link token
    if (!userId) {
      const orphanEmail = `discord_${discordId}@adultai.com`;

      let orphanUser = await db.user.findUnique({ where: { email: orphanEmail } });

      if (!orphanUser) {
        orphanUser = await db.user.create({
          data: {
            name: discordUsername || "Discord User",
            email: orphanEmail,
            emailVerified: new Date(),
            role: "USER",
            nuts: 100,
            freeGenerationsLimit: 50,
            freeGenerationsUsed: 0,
          },
        });

        await db.account.create({
          data: {
            userId: orphanUser.id,
            type: "oauth",
            provider: "discord",
            providerAccountId: discordId,
            access_token: "bot-linked",
            token_type: "bearer",
          },
        });
      }

      userId = orphanUser.id;
      isNewUser = true;
    }

    // Use user-supplied category first, then auto-detect from prompt, then "Uncategorized"
    const userCategoryName = categoryName?.trim() || null;
    const autoCategoryName = analyzePromptForCategory(prompt || "");
    const resolvedName = userCategoryName || autoCategoryName || "Uncategorized";

    const matchedCategory = await db.category.findFirst({
      where: { name: { equals: resolvedName, mode: "insensitive" } },
      select: { id: true, name: true },
    });

    // Fallback to Uncategorized if not found
    let categoryRecord = matchedCategory;
    if (!categoryRecord) {
      categoryRecord = await db.category.findFirst({
        where: { name: "Uncategorized" },
        select: { id: true, name: true },
      });
    }

    const categoryIds = categoryRecord ? [categoryRecord.id] : [];

    // Save the image
    const image = await db.generatedImage.create({
      data: {
        userId,
        prompt: prompt || "Discord import",
        imageUrl,
        isPublic: isPublic ?? false,
        status: "completed",
        progress: 100,
        width: width || 512,
        height: height || 768,
        modelId: "stable-diffusion",
        steps: 42,
        cfg: 6.8,
        sampler: "DPM++ 2M Karras",
        costNuts: 0,
        verified: new Date(),
        upvotes: 0,
        downvotes: 0,
        voteScore: 0,
        categoryIds,
      },
    });

    // Update the category's imageIds array
    if (categoryRecord && isPublic) {
      await db.category.update({
        where: { id: categoryRecord.id },
        data: { imageIds: { push: image.id } },
      });
    }

    // Auto-upvote: user saving an image = implicit like
    try {
      const { autoUpvoteImage } = await import("@/actions/votes/create");
      await autoUpvoteImage(userId, image.id);
    } catch {}

    // Generate claim token
    const claimToken = crypto.randomBytes(24).toString("hex");
    const claimExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    try {
      await db.discordClaimToken.upsert({
        where: { discordId },
        update: { token: claimToken, expiresAt: claimExpiry, orphanUserId: userId },
        create: {
          discordId,
          token: claimToken,
          expiresAt: claimExpiry,
          orphanUserId: userId,
        },
      });
    } catch (upsertErr) {
      console.warn('[DISCORD SAVE] discordClaimToken upsert failed (model may not exist):', upsertErr);
    }

    const claimUrl = `https://adultai.com/auth/link-discord?token=${claimToken}`;
    const galleryUrl = `https://adultai.com/gallery/user`;

    return NextResponse.json({
      success: true,
      imageId: image.id,
      userId,
      galleryUrl,
      claimUrl,
      isNewUser,
      categories: categoryRecord ? [categoryRecord] : [],
      cdnUrl: imageUrl,
    });

  } catch (error: any) {
    console.error("[DISCORD SAVE IMAGE]", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const headersList = await headers();
    const botSecret = headersList.get("x-bot-secret");
    if (botSecret !== BOT_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const discordId = searchParams.get("discordId");
    if (!discordId) return NextResponse.json({ error: "Missing discordId" }, { status: 400 });

    const account = await db.account.findFirst({
      where: { provider: "discord", providerAccountId: discordId },
      include: { user: { select: { name: true, email: true } } },
    });

    const isOrphan = account?.user?.email?.endsWith("@adultai.com") &&
                     account?.user?.email?.startsWith("discord_");

    return NextResponse.json({
      linked: !!account,
      isOrphan,
      userName: account?.user?.name || null,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
