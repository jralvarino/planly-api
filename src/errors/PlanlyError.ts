export class PlanlyError extends Error {
    public readonly statusCode: number;
    public readonly errorType: string;
    public readonly details?: any;

    constructor(message: string, statusCode: number = 500, errorType?: string, details?: any) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.errorType = errorType || this.getDefaultErrorType(statusCode);
        this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }

    private getDefaultErrorType(statusCode: number): string {
        const errorTypeMap: Record<number, string> = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            422: "UNPROCESSABLE_ENTITY",
            429: "TOO_MANY_REQUESTS",
            500: "INTERNAL_SERVER_ERROR",
            502: "BAD_GATEWAY",
            503: "SERVICE_UNAVAILABLE",
        };

        return errorTypeMap[statusCode] || "INTERNAL_SERVER_ERROR";
    }
}

export class BadRequestError extends PlanlyError {
    constructor(message: string, details?: any) {
        super(message, 400, "BAD_REQUEST", details);
        this.name = "BadRequestError";
    }
}

export class UnauthorizedError extends PlanlyError {
    constructor(message: string = "Unauthorized", details?: any) {
        super(message, 401, "UNAUTHORIZED", details);
        this.name = "UnauthorizedError";
    }
}

export class ForbiddenError extends PlanlyError {
    constructor(message: string = "Acesso negado", details?: any) {
        super(message, 403, "FORBIDDEN", details);
        this.name = "ForbiddenError";
    }
}

export class NotFoundError extends PlanlyError {
    constructor(message: string = "Resource not found", details?: any) {
        super(message, 404, "NOT_FOUND", details);
        this.name = "NotFoundError";
    }
}

export class ConflictError extends PlanlyError {
    constructor(message: string = "Conflict", details?: any) {
        super(message, 409, "CONFLICT", details);
        this.name = "ConflictError";
    }
}

export class ValidationError extends PlanlyError {
    constructor(message: string = "Validation error", details?: any) {
        super(message, 400, "VALIDATION_ERROR", details);
        this.name = "ValidationError";
    }
}

export class InternalServerError extends PlanlyError {
    constructor(message: string = "Internal server error", details?: any) {
        super(message, 500, "INTERNAL_SERVER_ERROR", details);
        this.name = "InternalServerError";
    }
}
