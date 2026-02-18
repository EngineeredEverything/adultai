import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { 
      name, 
      personality, 
      description, 
      characteristics, 
      imageUrl 
    } = await request.json();

    // Validate required fields
    if (!name || !imageUrl) {
      return NextResponse.json(
        { error: 'Name and image are required' },
        { status: 400 }
      );
    }

    // Create custom companion
    const companion = await prisma.companion.create({
      data: {
        name,
        slug: `custom-${session.user.id}-${Date.now()}`,
        imageUrl,
        category: 'custom',
        archetype: 'custom',
        personality: personality || 'Playful & Fun',
        traits: [],
        description: description || `A custom companion created by ${session.user.name || 'you'}`,
        characteristics: characteristics || {},
        featured: false,
        customizable: true,
        userId: session.user.id // Link to user who created it
      }
    });

    return NextResponse.json({ 
      success: true, 
      companionId: companion.id 
    });
  } catch (error) {
    console.error('Error creating companion:', error);
    return NextResponse.json(
      { error: 'Failed to create companion' },
      { status: 500 }
    );
  }
}
