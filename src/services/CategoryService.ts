import { injectable } from "tsyringe";
import { CategoryRepository } from "../repositories/CategoryRepository.js";
import { Category } from "../models/Category.js";
import { HabitService } from "./HabitService.js";
import { ConflictError, NotFoundError } from "../errors/PlanlyError.js";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger.js";

@injectable()
export class CategoryService {
    constructor(
        private readonly repository: CategoryRepository,
        private readonly habitService: HabitService
    ) {}

    async create(userId: string, name: string): Promise<Category> {
        const existing = await this.repository.findByName(userId, name.toLowerCase());

        if (existing) {
            logger.warn("Category create: name already exists", { userId, name: name.toLowerCase() });
            throw new ConflictError("A category with this name already exists");
        }

        const now = new Date().toISOString();
        const id = uuidv4();

        const category: Category = {
            id,
            userId,
            name: name.toLowerCase(),
            createdAt: now,
            updatedAt: now,
        };

        await this.repository.create(category);

        return formatCategoryForResponse(category);
    }

    async getAllCategories(userId: string): Promise<Category[]> {
        const categories = await this.repository.findAllByUserId(userId);
        return categories.map(formatCategoryForResponse);
    }

    async getCategoryById(userId: string, id: string): Promise<Category | null> {
        const category = await this.repository.findById(id);

        if (!category) {
            logger.warn("Category getById: not found", { userId, categoryId: id });
            throw new NotFoundError(`Category ${id} could not be found`);
        }
        if (category.userId != userId) {
            logger.warn("Category getById: user mismatch", { userId, categoryId: id });
            throw new NotFoundError(`Category ${id} could not be found for user ${userId}`);
        }

        return formatCategoryForResponse(category);
    }

    async getCategoryByName(userId: string, name: string): Promise<Category | null> {
        const category = await this.repository.findByName(userId, name);

        if (!category) {
            throw new NotFoundError(`Category ${name} could not be found`);
        }

        return formatCategoryForResponse(category);
    }

    async update(userId: string, id: string, newName: string): Promise<Category> {
        const oldCategory = await this.repository.findById(id);

        if (!oldCategory) {
            logger.warn("Category update: not found", { userId, categoryId: id });
            throw new NotFoundError(`Category ${id} could not be found`);
        }
        if (oldCategory.userId != userId) {
            logger.warn("Category update: user mismatch", { userId, categoryId: id });
            throw new NotFoundError(`Category ${id} could not be found for user ${userId}`);
        }

        const lowerCaseNewName = newName.toLowerCase();

        if (oldCategory.name.toLowerCase() !== lowerCaseNewName) {
            const existingWithNewName = await this.repository.findByName(userId, lowerCaseNewName);
            if (existingWithNewName && existingWithNewName.id !== oldCategory.id) {
                logger.warn("Category update: name already exists", { userId, categoryId: id, newName: lowerCaseNewName });
                throw new ConflictError("A category with this name already exists");
            }
            const updatedCategory = { ...oldCategory, name: lowerCaseNewName };

            await this.repository.update(updatedCategory);

            return formatCategoryForResponse(updatedCategory);
        } else {
            return oldCategory;
        }
    }

    async delete(userId: string, id: string): Promise<void> {
        const category = await this.repository.findById(id);

        if (!category) {
            logger.warn("Category delete: not found", { userId, categoryId: id });
            throw new NotFoundError("Category not found");
        }
        if (category.userId != userId) {
            logger.warn("Category delete: user mismatch", { userId, categoryId: id });
            throw new NotFoundError(`Category ${id} could not be found for user ${userId}`);
        }

        const habitsInCategory = await this.habitService.getAllHabits(userId, id);
        if (habitsInCategory.length > 0) {
            logger.warn("Category delete: has habits associated", { userId, categoryId: id, count: habitsInCategory.length });
            throw new ConflictError("Cannot delete category: it has habits associated");
        }

        await this.repository.delete(category.id);
        logger.debug("Category deleted", { userId, categoryId: id });
    }
}

function capitalizeFirstLetter(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatCategoryForResponse(category: Category): Category {
    return {
        ...category,
        name: capitalizeFirstLetter(category.name),
    };
}
