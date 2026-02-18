import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const companion = await prisma.companion.findUnique({
      where: { slug: params.slug }
    });

    if (!companion) {
      return NextResponse.json(
        { error: 'Companion not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(companion);
  } catch (error) {
    console.error('Error fetching companion:', error);
    return NextResponse.json(
      { error: 'Failed to fetch companion' },
      { status: 500 }
    );
  }
}
