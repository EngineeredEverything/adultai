// app/api/status/route.ts
import { NextResponse } from 'next/server'

const BASE_URL = process.env.AI_LLM_BASE_URL || "http://85.164.49.112:38713"

// app/api/health/route.ts
export async function GET() {
    try {
        const response = await fetch(`${BASE_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000), // Shorter timeout for health check
        })

        const isHealthy = response.ok

        return NextResponse.json({
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            responseTime: response.headers.get('response-time') || null,
        })
    } catch (error) {
        return NextResponse.json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Connection failed'
        })
    }
}