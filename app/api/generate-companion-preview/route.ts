import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const GPU_API_URL = process.env.GPU_API_URL || 'http://213.224.31.105:29612';
const GPU_API_KEY = process.env.GPU_API_KEY || 'Pd10V9L4ULaOxmq93oHTktk6Fa5FxjX2iASILCjWi1o';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { prompt, characteristics } = await request.json();

    // Call GPU API to generate image
    const response = await fetch(`${GPU_API_URL}/api/v1/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': GPU_API_KEY
      },
      body: JSON.stringify({
        prompt: prompt + ', photorealistic, detailed face, 8k',
        negative_prompt: 'low quality, blurry, deformed, ugly, child, young, minor, cartoon',
        width: 512,
        height: 768,
        num_inference_steps: 30,
        guidance_scale: 7.5
      })
    });

    if (!response.ok) {
      throw new Error('GPU API request failed');
    }

    // Get image buffer
    const imageBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // Upload to Bunny CDN
    const filename = `custom-${session.user.id}-${Date.now()}.jpg`;
    const bunnyResponse = await fetch(
      `https://${process.env.BUNNY_STORAGE_HOST}/${process.env.BUNNY_STORAGE_ZONE}/companions/${filename}`,
      {
        method: 'PUT',
        headers: {
          'AccessKey': process.env.BUNNY_API_KEY!,
          'Content-Type': 'image/jpeg'
        },
        body: Buffer.from(base64Image, 'base64')
      }
    );

    if (!bunnyResponse.ok) {
      throw new Error('Failed to upload to CDN');
    }

    const imageUrl = `${process.env.NEXT_PUBLIC_BUNNY_CDN_URL}/companions/${filename}`;

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('Error generating preview:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    );
  }
}
