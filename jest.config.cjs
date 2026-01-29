/** @type {import('jest').Config} */
module.exports = {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "node",
    roots: ["<rootDir>/tests"],
    testMatch: ["**/*.test.ts", "**/*.spec.ts"],
    moduleNameMapper: {
        "^\\.\\./db/dynamoClient\\.js$": "<rootDir>/tests/__mocks__/dynamoClient.cjs",
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                useESM: true,
            },
        ],
    },
    extensionsToTreatAsEsm: [".ts"],
    clearMocks: true,
    collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
    coverageDirectory: "coverage",
    verbose: true,
    watchman: false,
    testTimeout: 15000,
};
