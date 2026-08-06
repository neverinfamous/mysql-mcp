import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: process.env.CI ? ['**/ecosystem*.spec.ts', '**/payloads-ecosystem-*.spec.ts'] : undefined,
  globalTeardown: "./test-server/infrastructure/scripts/teardown.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Must be 1 since all tests share a single MCP Server instance and a single testdb. Parallel DDL causes metadata locks.
  timeout: 120000,
  outputDir: ".test-output/playwright-artifacts",
  reporter: [["list"], ["json", { outputFile: ".test-output/playwright-results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:3103",
    trace: "on-first-retry",
    actionTimeout: 0,
  },
  projects: [
    {
      name: "api",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `node dist/cli.js --transport http --port 3103 --server-host 127.0.0.1 --pool-size 50 --mysql ${process.env.MYSQL_TEST_URL ?? "mysql://root:root@127.0.0.1:6446/testdb"}`,
    port: 3103,
    reuseExistingServer: false,
    timeout: 120000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      REDIS_URL: 'redis://127.0.0.1:6379',
      MCP_CONFIG_PATH: './test-server/config/mcp-config.json',
      // Load all tools (override starter default)
      TOOL_FILTER: "+all",
      // Provide sandbox boundaries for E2E tests
      ALLOWED_IO_ROOTS: `${tmpdir()}`,
      // Prevent 429s during E2E runs with many client connections
      MCP_RATE_LIMIT_MAX: "100000",
      // ProxySQL admin connection
      PROXYSQL_HOST: "127.0.0.1",
      PROXYSQL_PORT: "6032",
      PROXYSQL_USER: "radmin",
      PROXYSQL_PASSWORD: "radmin",
      // MySQL Router REST API
      MYSQL_ROUTER_URL: "https://127.0.0.1:8443",
      MYSQL_ROUTER_USER: "rest_api",
      MYSQL_ROUTER_PASSWORD: "router_api",
      MYSQL_ROUTER_INSECURE: "true",
      // MySQL Shell
      MYSQLSH_PATH: process.env.MYSQLSH_PATH ?? "",
    },
  },
});
