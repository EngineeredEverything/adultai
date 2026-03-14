import { currentUser } from "@/utils/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const type = formData.get("type") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const filename = `${Date.now()}-${file.name}`;
  const folder = type === "cover" ? "covers" : "avatars";
  const path = `${folder}/${user.id}/${filename}`;

  // Get Bunny CDN credentials from env
  const bunnyStorageKey = process.env.BUNNY_STORAGE_KEY;
  const bunnyStorageName = process.env.BUNNY_STORAGE_NAME;

  if (!bunnyStorageKey || !bunnyStorageName) {
    return NextResponse.json(
      { error: "Storage not configured" },
      { status: 500 }
    );
  }

  try {
    // Upload to Bunny CDN
    const bunnyUrl = `https://${bunnyStorageName}.storage.bunnycdn.com/${path}`;
    const uploadResponse = await fetch(bunnyUrl, {
      method: "PUT",
      headers: {
        "AccessKey": bunnyStorageKey,
        "Content-Type": file.type,
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      console.error("Bunny upload failed:", await uploadResponse.text());
      return NextResponse.json(
        { error: "Upload failed" },
        { status: 500 }
      );
    }

    // Build CDN URL
    const cdnUrl = `https://${bunnyStorageName}.b-cdn.net/${path}`;

    // Update user in DB
    const field = type === "cover" ? "coverPhotoUrl" : "avatarUrl";
    await db.user.update({
      where: { id: user.id },
      data: {
        [field]: cdnUrl,
      },
    });

    return NextResponse.json({ success: true, url: cdnUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
