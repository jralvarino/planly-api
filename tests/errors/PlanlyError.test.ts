import { describe, it, expect } from "vitest";
import {
    CommonError as PlanlyError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    ValidationError,
    InternalServerError,
} from "@arj/common-utils-layer/error";

describe("PlanlyError", () => {
    it("creates with default statusCode 500", () => {
        const err = new PlanlyError("Something went wrong");
        expect(err.statusCode).toBe(500);
        expect(err.errorType).toBe("INTERNAL_SERVER_ERROR");
        expect(err.message).toBe("Something went wrong");
        expect(err.name).toBe("AppError");
        expect(err instanceof Error).toBe(true);
    });

    it("creates with provided statusCode and errorType", () => {
        const err = new PlanlyError("Bad request", 400, "BAD_REQUEST", { field: "name" });
        expect(err.statusCode).toBe(400);
        expect(err.errorType).toBe("BAD_REQUEST");
        expect(err.details).toEqual({ field: "name" });
    });

    it("creates without details", () => {
        const err = new PlanlyError("msg", 404);
        expect(err.details).toBeUndefined();
    });

    it.each([
        [400, "BAD_REQUEST"],
        [401, "UNAUTHORIZED"],
        [403, "FORBIDDEN"],
        [404, "NOT_FOUND"],
        [409, "CONFLICT"],
        [422, "UNPROCESSABLE_ENTITY"],
        [429, "TOO_MANY_REQUESTS"],
        [500, "INTERNAL_SERVER_ERROR"],
        [502, "BAD_GATEWAY"],
        [503, "SERVICE_UNAVAILABLE"],
    ])("maps statusCode %i to errorType %s", (statusCode, errorType) => {
        const err = new PlanlyError("msg", statusCode);
        expect(err.errorType).toBe(errorType);
    });

    it("falls back to INTERNAL_SERVER_ERROR for unknown statusCode", () => {
        const err = new PlanlyError("msg", 418);
        expect(err.errorType).toBe("INTERNAL_SERVER_ERROR");
    });
});

describe("BadRequestError", () => {
    it("sets statusCode 400 and correct name", () => {
        const err = new BadRequestError("bad request", { field: "x" });
        expect(err.statusCode).toBe(400);
        expect(err.errorType).toBe("BAD_REQUEST");
        expect(err.name).toBe("BadRequestError");
        expect(err.details).toEqual({ field: "x" });
    });

    it("works without details", () => {
        const err = new BadRequestError("bad");
        expect(err.message).toBe("bad");
        expect(err.details).toBeUndefined();
    });
});

describe("UnauthorizedError", () => {
    it("uses default message", () => {
        const err = new UnauthorizedError();
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe("Unauthorized");
        expect(err.name).toBe("UnauthorizedError");
    });

    it("accepts custom message", () => {
        const err = new UnauthorizedError("Token expired");
        expect(err.message).toBe("Token expired");
    });
});

describe("ForbiddenError", () => {
    it("sets statusCode 403 with default message", () => {
        const err = new ForbiddenError();
        expect(err.statusCode).toBe(403);
        expect(err.message).toBe("Access denied");
        expect(err.name).toBe("ForbiddenError");
    });
});

describe("NotFoundError", () => {
    it("sets statusCode 404 with custom message", () => {
        const err = new NotFoundError("Resource not found");
        expect(err.statusCode).toBe(404);
        expect(err.name).toBe("NotFoundError");
    });

    it("uses default message", () => {
        const err = new NotFoundError();
        expect(err.message).toBe("Resource not found");
    });
});

describe("ConflictError", () => {
    it("sets statusCode 409", () => {
        const err = new ConflictError("Conflict");
        expect(err.statusCode).toBe(409);
        expect(err.name).toBe("ConflictError");
    });

    it("uses default message", () => {
        const err = new ConflictError();
        expect(err.message).toBe("Conflict");
    });
});

describe("ValidationError", () => {
    it("sets statusCode 400 with VALIDATION_ERROR type", () => {
        const err = new ValidationError("validation error", [{ field: "name", message: "required" }]);
        expect(err.statusCode).toBe(400);
        expect(err.errorType).toBe("VALIDATION_ERROR");
        expect(err.name).toBe("ValidationError");
    });

    it("uses default message", () => {
        const err = new ValidationError();
        expect(err.message).toBe("Validation error");
    });
});

describe("InternalServerError", () => {
    it("sets statusCode 500 with default message", () => {
        const err = new InternalServerError();
        expect(err.statusCode).toBe(500);
        expect(err.name).toBe("InternalServerError");
        expect(err.message).toBe("Internal server error");
    });

    it("accepts custom message", () => {
        const err = new InternalServerError("Database failure");
        expect(err.message).toBe("Database failure");
    });
});
