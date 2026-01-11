export const loginSchema = {
    type: "object",
    properties: {
        body: {
            type: "object",
            required: ["user", "password"],
            properties: {
                user: {
                    type: "string",
                    minLength: 1,
                },
                password: {
                    type: "string",
                    minLength: 1,
                },
            },
            additionalProperties: false,
        },
    },
    required: ["body"],
};