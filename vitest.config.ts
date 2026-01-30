import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        globals: true,
        coverage: {
            provider: "v8",
            reporter: ["text", "text-summary", "html", "lcov"],
            reportsDirectory: "./coverage",
            include: ["src/**/*.ts"],
            exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "**/node_modules/**", "**/dist/**"],
            lines: 80,
            functions: 80,
            branches: 80,
            statements: 80,
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
