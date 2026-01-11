//Category Schema Validation

export const createCategorySchema = {
    type: "object",
    properties: {
        body: {
            type: "object",
            required: ["name"],
            properties: {
                name: {
                    type: "string",
                    minLength: 1,
                },
            },
            additionalProperties: false,
        },
    },
    required: ["body"],
};

export const updateCategorySchema = {
    type: "object",
    properties: {
        body: {
            type: "object",
            required: ["name"],
            properties: {
                name: {
                    type: "string",
                    minLength: 1,
                },
            },
            additionalProperties: false,
        },
        pathParameters: {
            type: "object",
            required: ["name"],
            properties: {
                name: {
                    type: "string",
                    minLength: 1,
                },
            },
        },
    },
    required: ["body", "pathParameters"],
};

export const getCategoriesSchema = {
    type: "object",
    properties: {
        pathParameters: {
            type: "object",
            properties: {},
        },
    },
};

export const getCategoryByNameSchema = {
    type: "object",
    properties: {
        pathParameters: {
            type: "object",
            required: ["name"],
            properties: {
                name: {
                    type: "string",
                    minLength: 1,
                },
            },
        },
    },
    required: ["pathParameters"],
};

export const deleteCategorySchema = {
    type: "object",
    properties: {
        pathParameters: {
            type: "object",
            required: ["name"],
            properties: {
                name: {
                    type: "string",
                    minLength: 1,
                },
            },
        },
    },
    required: ["pathParameters"],
};

