// Todo Status Constants
export const TODO_STATUS = {
    DONE: "done",
    PENDING: "pending",
    SKIPPED: "skipped",
} as const;

export type TodoStatus = typeof TODO_STATUS[keyof typeof TODO_STATUS];
