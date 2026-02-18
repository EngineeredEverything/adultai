import { logger } from "@/lib/logger"

export interface PerformanceMetrics {
    queryCount: number
    startTime: number
    endTime?: number
    duration?: number
    operation: string
    metadata?: Record<string, any>
}

export class PerformanceTracker {
    private metrics: PerformanceMetrics
    private queryCount = 0

    constructor(operation: string, metadata?: Record<string, any>) {
        this.metrics = {
            queryCount: 0,
            startTime: Date.now(),
            operation,
            metadata,
        }
    }

    /**
     * Increment query count
     */
    incrementQuery(queryName?: string) {
        this.queryCount++
        if (queryName && process.env.NODE_ENV === "development") {
            logger.debug(`[v0] Query executed: ${queryName}`, {
                operation: this.metrics.operation,
                currentCount: this.queryCount,
            })
        }
    }

    /**
     * Track a database query execution
     */
    async trackQuery<T>(queryName: string, queryFn: () => Promise<T>): Promise<T> {
        const start = Date.now()
        this.incrementQuery(queryName)

        try {
            const result = await queryFn()
            const duration = Date.now() - start

            if (process.env.NODE_ENV === "development") {
                logger.debug(`[v0] Query completed: ${queryName}`, {
                    duration: `${duration}ms`,
                    operation: this.metrics.operation,
                })
            }

            return result
        } catch (error) {
            const duration = Date.now() - start
            logger.error(`[v0] Query failed: ${queryName}`, {
                duration: `${duration}ms`,
                operation: this.metrics.operation,
                error,
            })
            throw error
        }
    }

    /**
     * Complete tracking and log results
     */
    complete(additionalMetadata?: Record<string, any>) {
        this.metrics.endTime = Date.now()
        this.metrics.duration = this.metrics.endTime - this.metrics.startTime
        this.metrics.queryCount = this.queryCount

        logger.info(`[v0] Performance: ${this.metrics.operation}`, {
            duration: `${this.metrics.duration}ms`,
            queryCount: this.metrics.queryCount,
            avgQueryTime: this.queryCount > 0 ? `${(this.metrics.duration / this.queryCount).toFixed(2)}ms` : "N/A",
            ...this.metrics.metadata,
            ...additionalMetadata,
        })

        return this.metrics
    }

    /**
     * Get current metrics without completing
     */
    getMetrics(): PerformanceMetrics {
        return {
            ...this.metrics,
            queryCount: this.queryCount,
            duration: Date.now() - this.metrics.startTime,
        }
    }
}

/**
 * Convenience function to track an entire operation
 */
export async function trackPerformance<T>(
    operation: string,
    fn: (tracker: PerformanceTracker) => Promise<T>,
    metadata?: Record<string, any>,
): Promise<T> {
    const tracker = new PerformanceTracker(operation, metadata)

    try {
        const result = await fn(tracker)
        tracker.complete()
        return result
    } catch (error) {
        tracker.complete({ error: true })
        throw error
    }
}
