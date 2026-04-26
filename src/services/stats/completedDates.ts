import { Todo } from "../../models/Todo.js";
import { TODO_STATUS } from "../../constants/todo.constants.js";

/** Returns the dates when the habit is DONE in the TODO list. */
export function getCompletedDatesFromTodoList(todos: Todo[], habitId: string): Set<string> {
    return todos.reduce<Set<string>>((set, t) => {
        if (t.habitId === habitId && t.status === TODO_STATUS.DONE) {
            set.add(t.date);
        }
        return set;
    }, new Set());
}

