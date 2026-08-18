import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [
        vue(),
    ],
    test: {
        coverage: {
            exclude: [
                "e2e/**",
                "src/background/background.ts",
                "src/**/main.ts",
                "test/**",
                "*.config.ts",
            ],
            include: [
                "src/**/*.ts",
                "src/**/*.vue",
            ],
            provider: "v8",
            reporter: [
                "text",
                "html",
            ],
            thresholds: {
                branches: 92,
                functions: 92,
                lines: 95,
                statements: 92,
            },
        },
        environment: "happy-dom",
        include: [
            "test/**/*.test.ts",
        ],
        setupFiles: [
            "./test/setup.ts",
        ],
    },
});
