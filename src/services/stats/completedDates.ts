import { Todo } from "../../models/Todo.js";
import { TODO_STATUS } from "../../constants/todo.constants.js";

/** Retorna as datas em que o hábito está DONE na lista de TODOs. */
export function getCompletedDatesFromTodoList(todos: Todo[], habitId: string): Set<string> {
    return todos.reduce<Set<string>>((set, t) => {
        if (t.habitId === habitId && t.status === TODO_STATUS.DONE) {
            set.add(t.date);
        }
        return set;
    }, new Set());
}

/** Datas em que todos os TODOs da categoria (habitIds) naquele dia estão DONE. */
export function getCompletedCategoryDatesFromTodoList(todos: Todo[], habitIds: Set<string>): Set<string> {
    const byDate = new Map<string, Todo[]>();
    for (const t of todos) {
        if (!habitIds.has(t.habitId)) continue;
        if (!byDate.has(t.date)) byDate.set(t.date, []);
        byDate.get(t.date)!.push(t);
    }
    const completed = new Set<string>();
    for (const [date, list] of byDate) {
        if (list.length > 0 && list.every((t) => t.status === TODO_STATUS.DONE)) {
            completed.add(date);
        }
    }
    return completed;
}

/** Datas em que todos os TODOs do usuário naquele dia estão DONE. */
export function getCompletedUserDatesFromTodoList(todos: Todo[]): Set<string> {
    const byDate = new Map<string, Todo[]>();
    for (const t of todos) {
        if (!byDate.has(t.date)) byDate.set(t.date, []);
        byDate.get(t.date)!.push(t);
    }
    const completed = new Set<string>();
    for (const [date, list] of byDate) {
        if (list.length > 0 && list.every((t) => t.status === TODO_STATUS.DONE)) {
            completed.add(date);
        }
    }
    return completed;
}
