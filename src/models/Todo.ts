import { TodoStatus } from "../constants/todo.constants.js";

export interface Todo {
    PK: string; // USER#<userId>
    SK: string; // DATE#YYYY-MM-DD#HABIT#<habitId>
    userId: string;
    habitId: string;
    date: string; // YYYY-MM-DD
    status: TodoStatus;
    progress: number;
    target: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}
