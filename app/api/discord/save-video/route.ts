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
    const {
      discordId,
      discordUsername,
      videoUrl,
      prompt,
      isPublic,
      width,
      height,
      fps,
      numFrames,
      duration,
      videoType, // "animation" | "lipsync" | "generated"
    } = body;

    if (!discordId || !videoUrl) {
      return NextResponse.json({ error: "Missing discordId or videoUrl" }, { status: 400 });
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

    // Auto-detect category from prompt
    const autoCategoryName = analyzePromptForCategory(prompt || "");
    const resolvedName = autoCategoryName || "Uncategorized";

    const matchedCategory = await db.category.findFirst({
      where: { name: { equals: resolvedName, mode: "insensitive" } },
      select: { id: true, name: true },
    });

    let categoryRecord = matchedCategory;
    if (!categoryRecord) {
      categoryRecord = await db.category.findFirst({
        where: { name: "Uncategorized" },
        select: { id: true, name: true },
      });
    }

    const categoryIds = categoryRecord ? [categoryRecord.id] : [];

    // Build prompt label based on video type
    const promptLabel = videoType === "lipsync"
      ? `[Lip Sync] ${prompt || "Discord lip sync"}`
      : videoType === "animation"
        ? `[Animation] ${prompt || "Discord animation"}`
        : prompt || "Discord video import";

    // Save the video
    const video = await db.generatedVideo.create({
      data: {
        userId,
        prompt: promptLabel,
        videoUrl,
        isPublic: isPublic ?? false,
        status: "completed",
        progress: 100,
        width: width || 768,
        height: height || 1152,
        fps: fps || 8,
        numFrames: numFrames || 25,
        duration: duration || null,
        modelId: videoType === "lipsync" ? "wav2lip" : "svd",
        steps: null,
        cfg: null,
        costNuts: 0,
        verified: new Date(),
        upvotes: 0,
        downvotes: 0,
        voteScore: 0,
        categoryIds,
      },
    });

    // Generate claim token for unlinked users
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
      console.warn('[DISCORD SAVE VIDEO] discordClaimToken upsert failed:', upsertErr);
    }

    const claimUrl = `https://adultai.com/auth/link-discord?token=${claimToken}`;
    const galleryUrl = `https://adultai.com/gallery/user`;

    return NextResponse.json({
      success: true,
      videoId: video.id,
      userId,
      galleryUrl,
      claimUrl,
      isNewUser,
      cdnUrl: videoUrl,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[DISCORD SAVE VIDEO]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
