// app/api/status/route.ts
import { NextResponse } from 'next/server'

const BASE_URL = process.env.AI_LLM_BASE_URL || "http://85.164.49.112:38713"

// app/api/models/route.ts
export async function GET() {
    try {
        const response = await fetch(`${BASE_URL}/api/tags`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(10000),
        })

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch models', models: [] },
                { status: response.status }
            )
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Models API Error:', error)
        return NextResponse.json(
            { error: 'Service unavailable', models: [] },
            { status: 503 }
        )
    }
}
