export const DYNAMO_TABLES = {
    HABIT: "planly-habit",
    CATEGORY: "planly-category",
    USER: "user",
    TODO: "planly-todo",
    STATS: "planly-stats",
} as const;

export const TODO_STATUS = {
    DONE: "done",
    PENDING: "pending",
    SKIPPED: "skipped",
} as const;

export type TodoStatus = (typeof TODO_STATUS)[keyof typeof TODO_STATUS];

export const TODO_STATUS_ORDER: Record<TodoStatus, number> = {
    [TODO_STATUS.PENDING]: 0,
    [TODO_STATUS.SKIPPED]: 1,
    [TODO_STATUS.DONE]: 2,
} as const;

export const TODO_PERIOD_ORDER: Record<string, number> = {
    Morning: 1,
    Afternoon: 2,
    Evening: 3,
    Anytime: 4,
};
