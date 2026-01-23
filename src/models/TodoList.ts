import { TodoStatus } from "../constants/todo.constants.js";

export interface TodoList {
    id: string;
    title: string;
    color: string;
    emoji: string;
    unit: string;
    targetValue: string;
    categoryId: string;
    period: string;
    active: boolean;
    status: TodoStatus;
    progressValue: string;
    notes: string;
    updatedAt: string;
}
