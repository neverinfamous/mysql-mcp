import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: process.env.CI ? ['**/ecosystem*.spec.ts', '**/payloads-ecosystem-*.spec.ts'] : undefined,
  globalTeardown: "./scripts/teardown.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60000,
  reporter: [["list"], ["json", { outputFile: ".test-output/playwright-results.json" }]],
  use: {
    baseURL: "http://localhost:3000",
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
    command: `node dist/cli.js --transport http --port 3000 --mysql ${process.env.MYSQL_TEST_URL ?? "mysql://root:root@localhost:3307/testdb"}`,
    url: "http://localhost:3000/health",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      // Load all tools (override starter default)
      TOOL_FILTER: "+all",
      // Provide sandbox boundaries for E2E tests
      ALLOWED_IO_ROOTS: `C:/temp,C:/tmp,/tmp,${tmpdir()}`,
      // Prevent 429s during E2E runs with many client connections
      MCP_RATE_LIMIT_MAX: "10000",
      // ProxySQL admin connection
      PROXYSQL_HOST: "localhost",
      PROXYSQL_PORT: "6032",
      PROXYSQL_USER: "radmin",
      PROXYSQL_PASSWORD: "radmin",
      // MySQL Router REST API
      MYSQL_ROUTER_URL: "https://localhost:8443",
      MYSQL_ROUTER_USER: "rest_api",
      MYSQL_ROUTER_PASSWORD: "router_api",
      MYSQL_ROUTER_INSECURE: "true",
      // MySQL Shell
      MYSQLSH_PATH:
        "C:\\Program Files\\MySQL\\MySQL Shell 9.5\\bin\\mysqlsh.exe",
    },
  },
});
