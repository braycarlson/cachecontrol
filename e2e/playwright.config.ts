import { defineConfig } from "@playwright/test";

export default defineConfig({
    forbidOnly: process.env["CI"] === "true",
    fullyParallel: false,
    reporter: [["list"]],
    retries: 0,
    testDir: "chromium",
    testMatch: "**/*.spec.ts",
    timeout: 120_000,
    workers: 1,
});
