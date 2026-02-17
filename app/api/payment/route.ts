import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { crc32 } from "crc";
import { promises as fs } from "fs";
import path from "path";
import { buySubscription } from "@/actions/subscriptions/update";
import { logger } from "@/lib/logger";

const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID!;
const CACHE_DIR = process.env.CACHE_DIR || ".cache";

async function downloadAndCache(url: string, cacheKey?: string): Promise<string> {
  if (!cacheKey) {
    cacheKey = url.replace(/\W+/g, "-");
  }

  const filePath = path.join(CACHE_DIR, cacheKey);

  // Check if cached file exists
  try {
    const cachedData = await fs.readFile(filePath, "utf-8");
    return cachedData;
  } catch {
    // Continue to download if not cached
  }

  const response = await fetch(url);
  const data = await response.text();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);

  return data;
}

async function verifySignature(eventRaw: Buffer, headers: Headers) {
  const transmissionId = headers.get("paypal-transmission-id");
  const timeStamp = headers.get("paypal-transmission-time");
  const certUrl = headers.get("paypal-cert-url");
  const signature = headers.get("paypal-transmission-sig");

  if (!transmissionId || !timeStamp || !certUrl || !signature || !WEBHOOK_ID) {
    return false;
  }

  const crc = crc32(eventRaw);
  const message = `${transmissionId}|${timeStamp}|${WEBHOOK_ID}|${crc}`;

  const certPem = await downloadAndCache(certUrl);
  const signatureBuffer = Buffer.from(signature, "base64");

  const verifier = crypto.createVerify("SHA256");
  verifier.update(message);

  return verifier.verify(certPem, signatureBuffer);
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.arrayBuffer();
    const eventRaw = Buffer.from(rawBody);

    const headers = req.headers;
    const isValid = await verifySignature(eventRaw, headers);

    const eventData = JSON.parse(eventRaw.toString("utf-8"));

    if (isValid) {
      logger.info("✅ Signature verified.");
      logger.info("🔔 Webhook Event:", JSON.stringify(eventData, null, 2));

      if (eventData.event_type === "CHECKOUT.ORDER.APPROVED") {
        const purchaseUnit = eventData.resource?.purchase_units?.[0];
        const customData = purchaseUnit?.custom_id;

        if (!customData) {
          console.warn("Missing custom_id in purchase_units");
          return NextResponse.json({ status: "missing_custom_id" });
        }

        let parsed;
        try {
          parsed = JSON.parse(customData);
        } catch (e) {
          console.error("Invalid custom_id JSON:", customData);
          return NextResponse.json({ status: "invalid_custom_id" });
        }

        const { userId, planId, billing } = parsed;

        if (!userId || !planId || !billing) {
          console.warn("Missing required fields in custom_id:", parsed);
          return NextResponse.json({ status: "missing_fields" });
        }

        // Get payment method ID from PayPal event
        const paymentMethod = eventData.resource?.id || "paypal";

        // Call buySubscription with correct parameters
        const result = await buySubscription({
          userId,
          planId,
          billingCycle: billing.toUpperCase(), // Convert to enum format (MONTHLY/YEARLY)
          paymentMethod,
        });

        if (result.success) {
          logger.info(`✅ Subscription created for user ${userId}:`, result.subscription);
        } else {
          console.warn(`❌ Subscription creation failed:`, result.error);
        }
      }
    } else {
      console.warn("❌ Signature verification failed for event:", eventData?.id);
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("⚠️ Error processing PayPal webhook:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}