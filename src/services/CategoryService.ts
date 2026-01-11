import { CategoryRepository } from "../repositories/CategoryRepository.js";
import { Category } from "../models/Category.js";
import { ConflictError, NotFoundError } from "../errors/PlanlyError.js";
import { v4 as uuidv4 } from "uuid";

export class CategoryService {
    private repository = new CategoryRepository();

    async create(userId: string, name: string): Promise<Category> {
        const existing = await this.repository.findByName(userId, name.toLowerCase());

        if (existing) {
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
            throw new NotFoundError(`Category ${id} could not be found`);
        }
        if (category.userId != userId) {
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
            throw new NotFoundError(`Category ${id} could not be found`);
        }
        if (oldCategory.userId != userId) {
            throw new NotFoundError(`Category ${id} could not be found for user ${userId}`);
        }

        const lowerCaseNewName = newName.toLowerCase();

        if (oldCategory.name.toLowerCase() !== lowerCaseNewName) {
            const existingWithNewName = await this.repository.findByName(userId, lowerCaseNewName);
            // Se encontrou e não é a mesma categoria (mesmo id), então é duplicata
            if (existingWithNewName && existingWithNewName.id !== oldCategory.id) {
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
            throw new NotFoundError("Category not found");
        }
        if (category.userId != userId) {
            throw new NotFoundError(`Category ${id} could not be found for user ${userId}`);
        }

        await this.repository.delete(category.id);
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
