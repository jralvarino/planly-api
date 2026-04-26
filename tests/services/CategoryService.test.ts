import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConflictError, NotFoundError } from "@arj/common-utils-layer/error";

vi.mock("@arj/common-utils-layer/util", () => ({
    createLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../../src/repositories/CategoryRepository.js", () => ({
    CategoryRepository: vi.fn(),
}));

vi.mock("../../src/services/HabitService.js", () => ({
    HabitService: vi.fn(),
}));

vi.mock("uuid", () => ({ v4: () => "test-uuid" }));

import { CategoryService } from "../../src/services/CategoryService.js";

const mockFindByName = vi.fn();
const mockCreate = vi.fn();
const mockFindAllByUserId = vi.fn();
const mockFindById = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockGetAllHabits = vi.fn();

describe("CategoryService", () => {
    let service: CategoryService;

    beforeEach(() => {
        vi.clearAllMocks();
        const mockRepository = {
            findByName: mockFindByName,
            create: mockCreate,
            findAllByUserId: mockFindAllByUserId,
            findById: mockFindById,
            update: mockUpdate,
            delete: mockDelete,
        };
        const mockHabitService = {
            getAllHabits: mockGetAllHabits,
        };
        service = new CategoryService(mockRepository as any, mockHabitService as any);
    });

    describe("create", () => {
        it("creates category and returns formatted name", async () => {
            mockFindByName.mockResolvedValue(null);
            mockCreate.mockResolvedValue(undefined);

            const result = await service.create("user-1", "health");

            expect(mockFindByName).toHaveBeenCalledWith("user-1", "health");
            expect(mockCreate).toHaveBeenCalled();
            expect(result.id).toBe("test-uuid");
            expect(result.name).toBe("Health");
            expect(result.userId).toBe("user-1");
        });

        it("lowercases name before checking existence", async () => {
            mockFindByName.mockResolvedValue(null);
            mockCreate.mockResolvedValue(undefined);

            await service.create("user-1", "HEALTH");

            expect(mockFindByName).toHaveBeenCalledWith("user-1", "health");
        });

        it("capitalizes first letter in response", async () => {
            mockFindByName.mockResolvedValue(null);
            mockCreate.mockResolvedValue(undefined);

            const result = await service.create("user-1", "EXERCISE");
            expect(result.name).toBe("Exercise");
        });

        it("throws ConflictError when name already exists", async () => {
            mockFindByName.mockResolvedValue({ id: "existing-id", name: "health" });

            await expect(service.create("user-1", "Health")).rejects.toThrow(ConflictError);
            await expect(service.create("user-1", "Health")).rejects.toThrow(
                "A category with this name already exists"
            );
        });
    });

    describe("getAllCategories", () => {
        it("returns all categories formatted", async () => {
            mockFindAllByUserId.mockResolvedValue([
                { id: "1", userId: "user-1", name: "health", createdAt: "", updatedAt: "" },
                { id: "2", userId: "user-1", name: "fitness", createdAt: "", updatedAt: "" },
            ]);

            const result = await service.getAllCategories("user-1");

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe("Health");
            expect(result[1].name).toBe("Fitness");
        });

        it("returns empty array when no categories", async () => {
            mockFindAllByUserId.mockResolvedValue([]);
            const result = await service.getAllCategories("user-1");
            expect(result).toEqual([]);
        });
    });

    describe("getCategoryById", () => {
        it("returns formatted category when found and userId matches", async () => {
            mockFindById.mockResolvedValue({
                id: "cat-1",
                userId: "user-1",
                name: "health",
                createdAt: "2024-01-01",
                updatedAt: "2024-01-01",
            });

            const result = await service.getCategoryById("user-1", "cat-1");

            expect(result?.id).toBe("cat-1");
            expect(result?.name).toBe("Health");
        });

        it("throws NotFoundError when category does not exist", async () => {
            mockFindById.mockResolvedValue(null);

            await expect(service.getCategoryById("user-1", "cat-1")).rejects.toThrow(NotFoundError);
        });

        it("throws NotFoundError when category belongs to different user", async () => {
            mockFindById.mockResolvedValue({
                id: "cat-1",
                userId: "other-user",
                name: "health",
                createdAt: "",
                updatedAt: "",
            });

            await expect(service.getCategoryById("user-1", "cat-1")).rejects.toThrow(NotFoundError);
        });
    });

    describe("getCategoryByName", () => {
        it("returns formatted category when found", async () => {
            mockFindByName.mockResolvedValue({
                id: "cat-1",
                userId: "user-1",
                name: "fitness",
                createdAt: "",
                updatedAt: "",
            });

            const result = await service.getCategoryByName("user-1", "fitness");
            expect(result?.name).toBe("Fitness");
        });

        it("throws NotFoundError when category not found", async () => {
            mockFindByName.mockResolvedValue(null);

            await expect(service.getCategoryByName("user-1", "fitness")).rejects.toThrow(NotFoundError);
        });
    });

    describe("update", () => {
        it("throws NotFoundError when category does not exist", async () => {
            mockFindById.mockResolvedValue(null);

            await expect(service.update("user-1", "cat-1", "New Name")).rejects.toThrow(NotFoundError);
        });

        it("throws NotFoundError when category belongs to different user", async () => {
            mockFindById.mockResolvedValue({
                id: "cat-1",
                userId: "other-user",
                name: "health",
                createdAt: "",
                updatedAt: "",
            });

            await expect(service.update("user-1", "cat-1", "New Name")).rejects.toThrow(NotFoundError);
        });

        it("returns current category without update when name is unchanged", async () => {
            const cat = { id: "cat-1", userId: "user-1", name: "health", createdAt: "", updatedAt: "" };
            mockFindById.mockResolvedValue(cat);

            const result = await service.update("user-1", "cat-1", "Health");

            expect(result).toEqual(cat);
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it("throws ConflictError when new name is taken by different category", async () => {
            mockFindById.mockResolvedValue({ id: "cat-1", userId: "user-1", name: "health", createdAt: "", updatedAt: "" });
            mockFindByName.mockResolvedValue({ id: "cat-2", name: "fitness" });

            await expect(service.update("user-1", "cat-1", "Fitness")).rejects.toThrow(ConflictError);
        });

        it("updates when new name is not taken", async () => {
            mockFindById.mockResolvedValue({ id: "cat-1", userId: "user-1", name: "health", createdAt: "", updatedAt: "" });
            mockFindByName.mockResolvedValue(null);
            mockUpdate.mockResolvedValue(undefined);

            const result = await service.update("user-1", "cat-1", "Fitness");

            expect(result.name).toBe("Fitness");
            expect(mockUpdate).toHaveBeenCalled();
        });

        it("updates when new name belongs to the same category", async () => {
            mockFindById.mockResolvedValue({ id: "cat-1", userId: "user-1", name: "health", createdAt: "", updatedAt: "" });
            mockFindByName.mockResolvedValue({ id: "cat-1", name: "fitness" });
            mockUpdate.mockResolvedValue(undefined);

            const result = await service.update("user-1", "cat-1", "Fitness");

            expect(result.name).toBe("Fitness");
            expect(mockUpdate).toHaveBeenCalled();
        });
    });

    describe("delete", () => {
        it("throws NotFoundError when category does not exist", async () => {
            mockFindById.mockResolvedValue(null);

            await expect(service.delete("user-1", "cat-1")).rejects.toThrow(NotFoundError);
        });

        it("throws NotFoundError when category belongs to different user", async () => {
            mockFindById.mockResolvedValue({ id: "cat-1", userId: "other-user", name: "health" });

            await expect(service.delete("user-1", "cat-1")).rejects.toThrow(NotFoundError);
        });

        it("throws ConflictError when category has associated habits", async () => {
            mockFindById.mockResolvedValue({ id: "cat-1", userId: "user-1", name: "health" });
            mockGetAllHabits.mockResolvedValue([{ id: "habit-1" }, { id: "habit-2" }]);

            await expect(service.delete("user-1", "cat-1")).rejects.toThrow(ConflictError);
            await expect(service.delete("user-1", "cat-1")).rejects.toThrow(
                "Cannot delete category: it has habits associated"
            );
        });

        it("deletes successfully when no habits are associated", async () => {
            mockFindById.mockResolvedValue({ id: "cat-1", userId: "user-1", name: "health" });
            mockGetAllHabits.mockResolvedValue([]);
            mockDelete.mockResolvedValue(undefined);

            await service.delete("user-1", "cat-1");

            expect(mockDelete).toHaveBeenCalledWith("cat-1");
        });
    });
});
