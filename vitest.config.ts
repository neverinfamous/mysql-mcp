import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    testTimeout: 10000,
    hookTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/__tests__/**",
        "**/*.test.ts",
      ],
      include: ["src/**/*.ts"],
    },
    // Pool configuration for single-worker execution (Vitest 4 format)
    pool: "forks",
    maxWorkers: 1,
    isolate: true,
  },
});
