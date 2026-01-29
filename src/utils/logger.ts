type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

function getMinLevel(): LogLevel {
    const env = process.env.LOG_LEVEL?.toLowerCase();
    if (env && env in LEVEL_ORDER) return env as LogLevel;
    return "debug";
}

function shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[getMinLevel()];
}

function formatTimestamp(): string {
    return new Date().toISOString();
}

function formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = formatTimestamp();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    if (data === undefined) return `${prefix} ${message}`;
    const dataStr = typeof data === "object" ? JSON.stringify(data, null, 2) : String(data);
    return `${prefix} ${message}\n${dataStr}`;
}

function log(level: LogLevel, message: string, data?: unknown): void {
    if (!shouldLog(level)) return;
    const formatted = formatMessage(level, message, data);
    switch (level) {
        case "debug":
            console.debug(formatted);
            break;
        case "info":
            console.info(formatted);
            break;
        case "warn":
            console.warn(formatted);
            break;
        case "error":
            console.error(formatted);
            break;
    }
}

export const logger = {
    debug(message: string, data?: unknown): void {
        log("debug", message, data);
    },
    info(message: string, data?: unknown): void {
        log("info", message, data);
    },
    warn(message: string, data?: unknown): void {
        log("warn", message, data);
    },
    error(message: string, data?: unknown): void {
        log("error", message, data);
    },
};
