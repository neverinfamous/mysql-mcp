import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    isolate: true,
    globalSetup: ["./scripts/teardown.ts"],
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    reporters: ["default"],
    testTimeout: 10000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      reportsDirectory: ".test-output/coverage",
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/__tests__/**",
        "**/*.test.ts",
      ],
      include: ["src/**/*.ts"],
    },
    pool: "forks",
    maxWorkers: 2,
    fileParallelism: true,
  },
});
