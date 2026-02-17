// hooks/useSystemStatus.ts
"use client"

import { useState, useEffect, useCallback } from 'react'

export interface Model {
    name: string
    model: string
    modified_at: string
    size: number
    digest: string
    details: {
        parent_model: string
        format: string
        family: string
        families: string[]
        parameter_size: string
        quantization_level: string
    }
}

export interface SystemStatus {
    status: 'online' | 'offline' | 'loading'
    models: Model[]
    timestamp: string
    error?: string
    uptime?: string
}

export interface HealthStatus {
    status: 'healthy' | 'unhealthy' | 'loading'
    timestamp: string
    responseTime?: string
    error?: string
}

export function useSystemStatus(intervalMs: number = 30000) {
    const [systemStatus, setSystemStatus] = useState<SystemStatus>({
        status: 'loading',
        models: [],
        timestamp: new Date().toISOString()
    })

    const [healthStatus, setHealthStatus] = useState<HealthStatus>({
        status: 'loading',
        timestamp: new Date().toISOString()
    })

    const [isPolling, setIsPolling] = useState(true)

    const fetchSystemStatus = useCallback(async () => {
        try {
            const response = await fetch('/api/status')
            const data = await response.json()

            if (response.ok) {
                setSystemStatus({
                    status: 'online',
                    models: data.models || [],
                    timestamp: data.timestamp,
                    uptime: data.uptime
                })
            } else {
                throw new Error(data.error || 'Failed to fetch status')
            }
        } catch (error) {
            console.error('Failed to fetch system status:', error)
            setSystemStatus(prev => ({
                ...prev,
                status: 'offline',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            }))
        }
    }, [])

    const fetchHealthStatus = useCallback(async () => {
        try {
            const response = await fetch('/api/health')
            const data = await response.json()

            setHealthStatus({
                status: data.status === 'healthy' ? 'healthy' : 'unhealthy',
                timestamp: data.timestamp,
                responseTime: data.responseTime,
                error: data.error
            })
        } catch (error) {
            console.error('Failed to fetch health status:', error)
            setHealthStatus(prev => ({
                ...prev,
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            }))
        }
    }, [])

    const refreshStatus = useCallback(async () => {
        await Promise.all([fetchSystemStatus(), fetchHealthStatus()])
    }, [fetchSystemStatus, fetchHealthStatus])

    const togglePolling = useCallback(() => {
        setIsPolling(prev => !prev)
    }, [])

    // Initial fetch
    useEffect(() => {
        refreshStatus()
    }, [refreshStatus])

    // Polling effect
    useEffect(() => {
        if (!isPolling) return

        const interval = setInterval(refreshStatus, intervalMs)
        return () => clearInterval(interval)
    }, [isPolling, intervalMs, refreshStatus])

    // Page visibility handling - pause polling when tab is hidden
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                setIsPolling(false)
            } else {
                setIsPolling(true)
                refreshStatus() // Immediate refresh when tab becomes visible
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [refreshStatus])

    return {
        systemStatus,
        healthStatus,
        isPolling,
        refreshStatus,
        togglePolling
    }
}