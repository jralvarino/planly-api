// Habit Schema Validation

export const createHabitSchema = {
    type: "object",
    properties: {
        body: {
            type: "object",
            required: ["title", "categoryId"],
            properties: {
                title: {
                    type: "string",
                    minLength: 1,
                },
                description: {
                    type: "string",
                },
                color: {
                    type: "string",
                },
                emoji: {
                    type: "string",
                },
                unit: {
                    type: "string",
                    enum: ["count", "pg", "km", "ml"],
                },
                value: {
                    type: "string",
                },
                period_type: {
                    type: "string",
                    enum: ["every_day", "specific_days_week", "specific_days_month"],
                },
                period_value: {
                    type: "string",
                },
                categoryId: {
                    type: "string",
                    minLength: 1,
                },
                period: {
                    type: "string",
                    enum: ["Anytime", "Morning", "Afternoon", "Evening"],
                },
                reminder_time: {
                    type: "string",
                },
                start_date: {
                    type: "string",
                },
                end_date: {
                    type: "string",
                },
                active: {
                    type: "boolean",
                },
            },
            additionalProperties: false,
        },
    },
    required: ["body"],
};

export const updateHabitSchema = {
    type: "object",
    properties: {
        body: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    minLength: 1,
                },
                description: {
                    type: "string",
                },
                color: {
                    type: "string",
                },
                emoji: {
                    type: "string",
                },
                unit: {
                    type: "string",
                    enum: ["count", "pg", "km", "ml"],
                },
                value: {
                    type: "string",
                },
                period_type: {
                    type: "string",
                    enum: ["every_day", "specific_days_week", "specific_days_month"],
                },
                period_value: {
                    type: "string",
                },
                categoryId: {
                    type: "string",
                    minLength: 1,
                },
                period: {
                    type: "string",
                    enum: ["Anytime", "Morning", "Afternoon", "Evening"],
                },
                reminder_time: {
                    type: "string",
                },
                start_date: {
                    type: "string",
                },
                end_date: {
                    type: "string",
                },
                active: {
                    type: "boolean",
                },
            },
            additionalProperties: false,
        },
        pathParameters: {
            type: "object",
            required: ["id"],
            properties: {
                id: {
                    type: "string",
                    minLength: 1,
                },
            },
        },
    },
    required: ["body", "pathParameters"],
};

export const getHabitsSchema = {
    type: "object",
    properties: {
        pathParameters: {
            type: "object",
            properties: {},
        },
    },
};

export const getHabitByIdSchema = {
    type: "object",
    properties: {
        pathParameters: {
            type: "object",
            required: ["id"],
            properties: {
                id: {
                    type: "string",
                    minLength: 1,
                },
            },
        },
    },
    required: ["pathParameters"],
};

export const getHabitsByCategorySchema = {
    type: "object",
    properties: {
        pathParameters: {
            type: "object",
            required: ["categoryId"],
            properties: {
                categoryId: {
                    type: "string",
                    minLength: 1,
                },
            },
        },
    },
    required: ["pathParameters"],
};

export const deleteHabitSchema = {
    type: "object",
    properties: {
        pathParameters: {
            type: "object",
            required: ["id"],
            properties: {
                id: {
                    type: "string",
                    minLength: 1,
                },
            },
        },
    },
    required: ["pathParameters"],
};
