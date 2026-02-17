// app/api/status/route.ts
import { NextResponse } from 'next/server'

const BASE_URL = process.env.AI_IMAGE_BASE_URL || "http://85.164.49.112:38713"

export async function GET() {
    try {
        const response = await fetch(`${BASE_URL}/status`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            // Add timeout to prevent hanging requests
            signal: AbortSignal.timeout(10000), // 10 seconds timeout
        })

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch status', status: 'offline' },
                { status: response.status }
            )
        }

        const data = await response.json()

        // Transform the data to include additional status info
        const statusData = {
            ...data,
            timestamp: new Date().toISOString(),
            uptime: response.headers.get('uptime') || null,
        }

        return NextResponse.json(statusData)
    } catch (error) {
        console.error('Status API Error:', error)

        return NextResponse.json(
            {
                error: 'Service unavailable',
                status: 'offline',
                timestamp: new Date().toISOString(),
                models: []
            },
            { status: 503 }
        )
    }
}


