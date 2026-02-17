type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    metadata: any[];
    rawMetadata: any[];
}

export const logger = {
    debug: (message: any, ...metadata: any[]) =>
        log("debug", message, metadata),
    info: (message: any, ...metadata: any[]) => log("info", message, metadata),
    warn: (message: any, ...metadata: any[]) => log("warn", message, metadata),
    error: (message: any, ...metadata: any[]) =>
        log("error", message, metadata),
};

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
export const points_to_coupon = {
    basePoints: 100,
    multiplier: 10,
};

const getCurrentLogLevel = (): LogLevel => {
    return (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || "debug";
};

const formatMetadata = (metadata: any[]): string => {
    return metadata
        .map((item) => {
            try {
                return typeof item === "object"
                    ? JSON.stringify(item, (key, value) => {
                        if (value instanceof Error) {
                            return {
                                name: value.name,
                                message: value.message,
                                stack: value.stack,
                            };
                        }
                        if (typeof value === "bigint") {
                            return value.toString();
                        }
                        if (value instanceof Set) {
                            return Array.from(value);
                        }
                        if (value instanceof Map) {
                            return Object.fromEntries(value);
                        }
                        return value;
                    })
                    : String(item);
            } catch (error) {
                return `[Non-Serializable Object: ${typeof item}]`;
            }
        })
        .join(" ");
};

const formatMessage = (entry: LogEntry): string => {
    const { level, message, timestamp, metadata } = entry;
    const metadataString = metadata ? ` ${formatMetadata(metadata)}` : "";
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metadataString}`;
};

const log = (level: LogLevel, message: string, metadata?: any) => {
    const currentLevel = getCurrentLogLevel();
    if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) {
        return;
    }

    const entry: LogEntry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        metadata: metadata || [],
        rawMetadata: metadata, // Preserve original data
    };

    if (process.env.PRODUCTION === "true") {
        console.log(formatMetadata([entry]));
    } else {
        const colors = {
            debug: "\x1b[36m",
            info: "\x1b[32m",
            warn: "\x1b[33m",
            error: "\x1b[31m",
            reset: "\x1b[0m",
        };

        console.log(`${colors[level]}${formatMessage(entry)}${colors.reset}`);

        // Log raw metadata if needed
        if (metadata?.length) {
            console.dir(metadata, { depth: null, colors: true });
        }
    }
};
