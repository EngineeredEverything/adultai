import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getClientIP } from "@/lib/getClientIP";

export async function GET(req: NextRequest) {
    const ip = getClientIP(req);
    return NextResponse.json({ ip });
}
