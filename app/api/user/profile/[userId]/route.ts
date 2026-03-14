import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const user = await db.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        avatarUrl: true,
        coverPhotoUrl: true,
        username: true,
        isCreator: true,
        creatorVerified: true,
        socialLinks: true,
        totalEarnings: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Count public and private images
    const publicCount = await db.generatedImage.count({
      where: { userId: params.userId, isPublic: true },
    });

    const privateCount = await db.generatedImage.count({
      where: { userId: params.userId, isPublic: false },
    });

    // Count total votes on user's public images
    const voteResult = await db.imageVote.aggregate({
      where: {
        image: {
          userId: params.userId,
          isPublic: true,
        },
      },
      _count: true,
    });

    return NextResponse.json({
      profile: user,
      stats: {
        publicCount,
        privateCount,
        totalVotes: voteResult._count,
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
