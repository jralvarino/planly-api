import { describe, it, expect } from "vitest";
import { success, created, noContent } from "@arj/common-utils-layer/util";

describe("success", () => {
    it("returns statusCode 200", () => {
        const res = success({ data: "test" });
        expect(res.statusCode).toBe(200);
    });

    it("sets Content-Type header", () => {
        const res = success({});
        expect(res.headers?.["Content-Type"]).toBe("application/json");
    });

    it("serializes body to JSON", () => {
        const res = success({ key: "value", count: 42 });
        expect(JSON.parse(res.body)).toEqual({ key: "value", count: 42 });
    });

    it("merges additional headers", () => {
        const res = success({}, { "X-Custom": "custom-value" });
        expect(res.headers?.["X-Custom"]).toBe("custom-value");
        expect(res.headers?.["Content-Type"]).toBe("application/json");
    });

    it("handles null body", () => {
        const res = success(null);
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toBeNull();
    });

    it("handles array body", () => {
        const res = success([1, 2, 3]);
        expect(JSON.parse(res.body)).toEqual([1, 2, 3]);
    });
});

describe("created", () => {
    it("returns statusCode 201", () => {
        const res = created({ id: "123" });
        expect(res.statusCode).toBe(201);
    });

    it("serializes body to JSON", () => {
        const res = created({ id: "abc", name: "test" });
        expect(JSON.parse(res.body)).toEqual({ id: "abc", name: "test" });
    });

    it("merges additional headers", () => {
        const res = created({}, { Location: "/resource/123" });
        expect(res.headers?.["Location"]).toBe("/resource/123");
    });
});

describe("noContent", () => {
    it("returns statusCode 204", () => {
        const res = noContent();
        expect(res.statusCode).toBe(204);
    });

    it("returns empty body", () => {
        const res = noContent();
        expect(res.body).toBe("");
    });

    it("sets Content-Type header", () => {
        const res = noContent();
        expect(res.headers?.["Content-Type"]).toBe("application/json");
    });

    it("merges additional headers", () => {
        const res = noContent({ "X-Info": "done" });
        expect(res.headers?.["X-Info"]).toBe("done");
    });
});
