import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock("@arj/common-utils-layer/util", () => ({
    createLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() })),
}));

vi.mock("@arj/common-utils-layer/db", () => ({
    ddb: { send: mockSend },
}));

import { CategoryRepository } from "../../src/repositories/CategoryRepository.js";
import type { Category } from "../../src/models/Category.js";

const baseCategory: Category = {
    id: "cat-1",
    userId: "user-1",
    name: "health",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
};

describe("CategoryRepository", () => {
    let repo: CategoryRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new CategoryRepository();
    });

    describe("create", () => {
        it("calls ddb.send with PutCommand", async () => {
            mockSend.mockResolvedValue({});
            await repo.create(baseCategory);
            expect(mockSend).toHaveBeenCalledOnce();
        });
    });

    describe("update", () => {
        it("calls ddb.send with PutCommand", async () => {
            mockSend.mockResolvedValue({});
            await repo.update(baseCategory);
            expect(mockSend).toHaveBeenCalledOnce();
        });
    });

    describe("findById", () => {
        it("returns category when found", async () => {
            mockSend.mockResolvedValue({ Item: baseCategory });
            const result = await repo.findById("cat-1");
            expect(result).toEqual(baseCategory);
        });

        it("returns null when not found", async () => {
            mockSend.mockResolvedValue({ Item: undefined });
            const result = await repo.findById("not-found");
            expect(result).toBeNull();
        });
    });

    describe("findByName", () => {
        it("returns category when found", async () => {
            mockSend.mockResolvedValue({ Items: [baseCategory] });
            const result = await repo.findByName("user-1", "health");
            expect(result).toEqual(baseCategory);
        });

        it("returns null when no items", async () => {
            mockSend.mockResolvedValue({ Items: [] });
            const result = await repo.findByName("user-1", "notfound");
            expect(result).toBeNull();
        });

        it("returns null when Items is undefined", async () => {
            mockSend.mockResolvedValue({ Items: undefined });
            const result = await repo.findByName("user-1", "notfound");
            expect(result).toBeNull();
        });
    });

    describe("findAllByUserId", () => {
        it("returns all categories for user", async () => {
            mockSend.mockResolvedValue({ Items: [baseCategory] });
            const result = await repo.findAllByUserId("user-1");
            expect(result).toEqual([baseCategory]);
        });

        it("returns empty array when no categories", async () => {
            mockSend.mockResolvedValue({ Items: undefined });
            const result = await repo.findAllByUserId("user-1");
            expect(result).toEqual([]);
        });
    });

    describe("delete", () => {
        it("calls ddb.send with DeleteCommand", async () => {
            mockSend.mockResolvedValue({});
            await repo.delete("cat-1");
            expect(mockSend).toHaveBeenCalledOnce();
        });
    });
});
