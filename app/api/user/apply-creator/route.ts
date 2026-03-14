import { currentUser } from "@/utils/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        isCreator: true,
        creatorAppliedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error("Creator application error:", error);
    return NextResponse.json(
      { error: "Failed to apply for creator status" },
      { status: 500 }
    );
  }
}
