import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

const BUNNY_API_KEY = process.env.BUNNY_API_KEY || ""
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || "storage-adultai"
const BUNNY_STORAGE_HOST = process.env.BUNNY_STORAGE_HOST || "la.storage.bunnycdn.com"
const BUNNY_CDN_URL = process.env.NEXT_PUBLIC_BUNNY_CDN_URL || "https://adultai-com.b-cdn.net"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

export async function POST(req: NextRequest) {
  try {
    // Must be authenticated
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const consentGiven = formData.get("consent") === "true"
    const ageConfirmed = formData.get("ageConfirmed") === "true"
    const purposeConfirmed = formData.get("purposeConfirmed") === "true"

    // ── Consent gates (required) ───────────────────────────────────────────
    if (!consentGiven || !ageConfirmed || !purposeConfirmed) {
      return NextResponse.json(
        { error: "All consent confirmations are required before uploading" },
        { status: 400 }
      )
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // ── File validation ────────────────────────────────────────────────────
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are allowed" },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      )
    }

    // ── Upload to Bunny CDN ────────────────────────────────────────────────
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
    const filename = `uploads/${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const uploadRes = await fetch(
      `https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${filename}`,
      {
        method: "PUT",
        headers: {
          AccessKey: BUNNY_API_KEY,
          "Content-Type": file.type,
        },
        body: buffer,
      }
    )

    if (!uploadRes.ok) {
      console.error("Bunny upload failed:", uploadRes.status)
      return NextResponse.json({ error: "Upload failed" }, { status: 502 })
    }

    const url = `${BUNNY_CDN_URL}/${filename}`

    // ── Log consent record ─────────────────────────────────────────────────
    // In production: persist this to DB for audit trail
    console.log("[upload-image] Consent record", {
      userId: session.user.id,
      url,
      consentGiven,
      ageConfirmed,
      purposeConfirmed,
      timestamp: new Date().toISOString(),
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
      userAgent: req.headers.get("user-agent"),
    })

    return NextResponse.json({ url, filename })

  } catch (err: any) {
    console.error("upload-image error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
