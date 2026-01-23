// Todo Schema Validation

export const updateTodoStatusSchema = {
    type: "object",
    properties: {
        body: {
            type: "object",
            required: ["status", "date"],
            properties: {
                date: {
                    type: "string",
                    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                },
                status: {
                    type: "string",
                    enum: ["done", "pending", "skipped"],
                },
                progressValue: {
                    type: "number",
                    minimum: 0,
                },
                notes: {
                    type: "string",
                },
            },
            additionalProperties: false,
        },
        pathParameters: {
            type: "object",
            required: ["habitId"],
            properties: {
                habitId: {
                    type: "string",
                    minLength: 1,
                },
            },
        },
    },
    required: ["body", "pathParameters"],
};

export const updateTodoSchema = {
    type: "object",
    properties: {
        body: {
            type: "object",
            properties: {
                status: {
                    type: "string",
                    enum: ["done", "pending", "skiped"],
                },
                progress: {
                    type: "number",
                    minimum: 0,
                },
                target: {
                    type: "number",
                    minimum: 0,
                },
                notes: {
                    type: "string",
                },
            },
            additionalProperties: false,
        },
        pathParameters: {
            type: "object",
            required: ["habitId", "date"],
            properties: {
                habitId: {
                    type: "string",
                    minLength: 1,
                },
                date: {
                    type: "string",
                    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                },
            },
        },
    },
    required: ["body", "pathParameters"],
};

export const updateTodoNotesSchema = {
    type: "object",
    properties: {
        body: {
            type: "object",
            required: ["notes", "date"],
            properties: {
                date: {
                    type: "string",
                    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                },
                notes: {
                    type: "string",
                },
            },
            additionalProperties: false,
        },
        pathParameters: {
            type: "object",
            required: ["habitId"],
            properties: {
                habitId: {
                    type: "string",
                    minLength: 1,
                },
            },
        },
    },
    required: ["body", "pathParameters"],
};
