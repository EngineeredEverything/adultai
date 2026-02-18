// app/api/webhooks/image-generation/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { uploadToCDNWithRetry } from "@/lib/modelsLab/image-generation";
import { getImageProvider } from "@/actions/images/provider";
import { checkImageStatus, checkImageStatusRaw } from "@/actions/images/info";
const provider = getImageProvider("CUSTOM");
const API_TOKEN = process.env.BOT_API_TOKEN;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    logger.debug("Received webhook:", body);

    // Validate webhook data
    if (!body.id || !body.status) {
      return NextResponse.json(
        { error: "Invalid webhook data" },
        { status: 400 }
      );
    }

    // Find all pending images with this task ID
    const pendingImages = await db.generatedImage.findMany({
      where: {
        taskId: body.id,
        status: { in: ["processing"] },
      },
      select: { id: true, path: true, userId: true },
    });

    if (pendingImages.length === 0) {
      return NextResponse.json(
        { error: "No pending images found with this task ID" },
        { status: 404 }
      );
    }
    logger.debug("Fetch status response:", body.output.length);

    // Process based on status
    if (body.status === "success" && body.output && body.output.length > 0) {
      // Update images with the generated URLs
      const updatePromises = pendingImages.map(async (pendingImage, index) => {
        const imageUrl = index < body.output.length ? body.output[index] : null;

        if (!imageUrl) {
          return db.generatedImage.update({
            where: { id: pendingImage.id },
            data: {
              status: "failed",
              updatedAt: new Date(),
            },
          });
        }

        // Upload to CDN
        try {
          const { path, cdnUrl } = await provider.uploadToCDNWithRetry(
            imageUrl,
            3,
            // body.id
          );

          return db.generatedImage.update({
            where: { id: pendingImage.id },
            data: {
              status: "completed",
              imageUrl: cdnUrl,
              path: path,
              verified: new Date(),
              updatedAt: new Date(),
            },
          });
        } catch (error) {
          logger.debug("Error uploading to CDN:", error);

          // Still update with original URL if CDN upload fails
          return db.generatedImage.update({
            where: { id: pendingImage.id },
            data: {
              status: "completed",
              imageUrl: "",
              verified: new Date(),
              updatedAt: new Date(),
            },
          });
        }
      });

      await Promise.all(updatePromises);

      return NextResponse.json({ status: "success" });
    } else if (body.status === "processing") {
      // Update ETA if available
      if (body.eta) {
        await db.generatedImage.updateMany({
          where: {
            taskId: body.id,
          },
          data: {
            status: "processing",
            eta: body.eta,
          },
        });
      }

      return NextResponse.json({ status: "processing" });
    } else {
      // Handle error
      await db.generatedImage.updateMany({
        where: {
          taskId: body.id,
        },
        data: {
          status: "failed",
        },
      });

      return NextResponse.json({ status: "failed" });
    }
  } catch (error) {
    logger.debug("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get("taskId");

    // Headers
    const email = req.headers.get("x-email");
    const password = req.headers.get("x-password");
    const headerToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    const token = headerToken;

    if (!token || token !== API_TOKEN) {
      logger.warn("Unauthorized access attempt", { token });
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!taskId) {
      return NextResponse.json(
        { error: "Missing taskId parameter" },
        { status: 400 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing email or password headers" },
        { status: 400 }
      );
    }

    let user = await db.user.findUnique({ where: { email } });

    if (!user) {
      logger.info("Creating new bot user", { email });
      user = await db.user.create({
        data: {
          name: "Bot User",
          email,
          password,
          role: "BOT",
        },
      });
      logger.info("Bot user created successfully", { userId: user.id, email });
    }

    if (user.role !== "BOT") {
      logger.error("User is not a bot", { userId: user.id, email, role: user.role });
      throw new Error("User is not a bot");
    }

    if (password !== user.password) {
      logger.error("Invalid credentials for bot user", { userId: user.id, email });
      throw new Error("Invalid credentials");
    }

    logger.info("Bot user authenticated successfully", { userId: user.id, email });

    const pendingImages = await checkImageStatusRaw({
      user,
      data: { taskId },
    });

    return NextResponse.json(pendingImages);
  } catch (error) {
    logger.debug("Error fetching pending images:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
