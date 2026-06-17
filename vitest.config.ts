import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    globalSetup: ["./scripts/teardown.ts"],
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    reporters: ["default"],
    testTimeout: 10000,
    hookTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
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
    isolate: true,
  },
});
