"use client"

import { logger } from "@/lib/logger"
import { useState, useEffect, useCallback, useRef } from "react"

export type SystemData = {
    status: string;
    model_loaded: boolean;
    system_info: {
        os: string;
        os_version: string;
        cpu_model: string;
        cpu_cores: number;
        cpu_threads: number;
        python_version: string;
    };
    gpu_info: {
        status: string;
        total_gb: number;
        allocated_gb: number;
        cached_gb: number;
        free_gb: number;
        utilization_percent: number;
        safety_threshold_gb: number;
        min_free_threshold_gb: number;
    };
    memory: {
        ram_process_mb: number;
        gpu_stats: {
            status: string;
            total_gb: number;
            allocated_gb: number;
            cached_gb: number;
            free_gb: number;
            utilization_percent: number;
            safety_threshold_gb: number;
            min_free_threshold_gb: number;
        };
        gpu_used_mb: string;
    };
    gpu_data: {
        status: string;
        system_info: {
            os: string;
            os_version: string;
            cpu_model: string;
            python_version: string;
            timestamp: string;
        };
        nvidia_smi: {
            gpus: {
                gpu_id: number;
                name: string;
                driver_version: string;
                temperature: number;
                utilization_gpu: number;
                utilization_memory: number;
                memory_total_mb: number;
                memory_used_mb: number;
                memory_free_mb: number;
                power_draw_w: number;
                power_limit_w: number;
                clock_graphics_mhz: number;
                clock_memory_mhz: number;
                fan_speed: number;
            }[];
            timestamp: string;
        };
        pytorch: null | any;
        gpu_processes: {
            pid: string;
            process_name: string;
            gpu_uuid: string;
            used_memory_mb: number;
        }[];
        monitoring_timestamp: string;
    };
    cpu: {
        usage_percent: number;
    };
    storage: {
        total_gb: number;
        used_gb: number;
        free_gb: number;
    };
};


interface UseSystemMonitoringOptions {
    apiUrl: string
    pollingInterval?: number // in milliseconds
    enabled?: boolean
    onError?: (error: string) => void
    onSuccess?: (data: SystemData) => void
}

interface UseSystemMonitoringReturn {
    data: SystemData | null
    isLoading: boolean
    error: string | null
    isConnected: boolean
    lastUpdated: Date | null
    refetch: () => Promise<void>
    startPolling: () => void
    stopPolling: () => void
}

export function useSystemMonitoring({
    apiUrl,
    pollingInterval = 5000, // Default 5 seconds
    enabled = true,
    onError,
    onSuccess,
}: UseSystemMonitoringOptions): UseSystemMonitoringReturn {
    const [data, setData] = useState<SystemData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)
    const isPollingRef = useRef(false)

    const fetchSystemData = useCallback(async (): Promise<void> => {
        try {
            // Cancel previous request if still pending
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }

            abortControllerRef.current = new AbortController()

            const response = await fetch(apiUrl, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
                signal: abortControllerRef.current.signal,
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const systemData: SystemData = await response.json()
            logger.debug("Fetched system data:", systemData)
            setData(systemData)
            setError(null)
            setIsConnected(true)
            setLastUpdated(new Date())

            onSuccess?.(systemData)
        } catch (err) {
            // Don't set error if request was aborted (component unmounting or new request)
            if (err instanceof Error && err.name === "AbortError") {
                return
            }

            const errorMessage = err instanceof Error ? err.message : "Failed to fetch system data"
            setError(errorMessage)
            setIsConnected(false)

            onError?.(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }, [apiUrl, onError, onSuccess])

    const startPolling = useCallback(() => {
        if (isPollingRef.current || !enabled) return

        isPollingRef.current = true

        // Fetch immediately
        fetchSystemData()

        // Set up polling
        intervalRef.current = setInterval(() => {
            fetchSystemData()
        }, pollingInterval)
    }, [fetchSystemData, pollingInterval, enabled])

    const stopPolling = useCallback(() => {
        isPollingRef.current = false

        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }

        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            abortControllerRef.current = null
        }
    }, [])

    const refetch = useCallback(async (): Promise<void> => {
        setIsLoading(true)
        await fetchSystemData()
    }, [fetchSystemData])

    // Start polling when hook mounts or when enabled changes
    useEffect(() => {
        if (enabled) {
            startPolling()
        } else {
            stopPolling()
        }

        return () => {
            stopPolling()
        }
    }, [enabled, startPolling, stopPolling])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopPolling()
        }
    }, [stopPolling])

    // Handle visibility change to pause/resume polling when tab is not visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopPolling()
            } else if (enabled) {
                startPolling()
            }
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
        }
    }, [enabled, startPolling, stopPolling])

    return {
        data,
        isLoading,
        error,
        isConnected,
        lastUpdated,
        refetch,
        startPolling,
        stopPolling,
    }
}
