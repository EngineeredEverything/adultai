import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';

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
        prompt: prompt + ', photorealistic, detailed face, natural skin, soft lighting',
        negative_prompt: '(worst quality, low quality:1.4), blurry, deformed, bad anatomy, extra fingers, poorly drawn hands, plastic skin, oversharpened, watermark, text, logo, cgi, 3d render, cartoon, child, minor',
        width: 512,
        height: 768,
        num_inference_steps: 42,
        guidance_scale: 6.8,
        hires_fix: true,
        hires_scale: 1.75,
        hires_denoise: 0.4,
        hires_steps: 28,
        face_restore: true,
        face_restore_strength: 0.2
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
