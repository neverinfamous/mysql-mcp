/**
 * E2E Tests: Code Mode (mysql_execute_code)
 *
 * Tests sandbox fundamentals, security enforcement, and multi-step workflows.
 * Adapted from db-mcp's sqlite_execute_code tests for mysql-mcp's mysql_execute_code.
 *
 * Ported from db-mcp/tests/e2e/codemode.spec.ts — adapted for mysql-mcp.
 */

import { test, expect } from "@playwright/test";
import {
  createClient,
  callToolAndParse,
  expectSuccess,
  expectHandlerError,
} from "./helpers.js";

test.describe.configure({ mode: "serial" });

// =============================================================================
// Sandbox Basics
// =============================================================================

test.describe("Code Mode: Sandbox Basics", () => {
  test.beforeEach(() => {
    test.setTimeout(120_000);
  });
  test("should return a simple value", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: "return 42;",
      });
      expectSuccess(p);
      expect(p.result).toBe(42);
    } finally {
      await client.close();
    }
  });

  test("should return a string", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: 'return "hello";',
      });
      expectSuccess(p);
      expect(p.result).toBe("hello");
    } finally {
      await client.close();
    }
  });

  test("should return an object", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: 'return { a: 1, b: "two" };',
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.a).toBe(1);
      expect(result.b).toBe("two");
    } finally {
      await client.close();
    }
  });

  test("should handle async/await", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          const result = await mysql.core.readQuery({ query: "SELECT 1 AS val" });
          return (result.data?.rows ?? result.rows)[0].val;
        `,
      });
      expectSuccess(p);
      expect(p.result).toBe(1);
    } finally {
      await client.close();
    }
  });

  test("should return runtime error for invalid code", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: "throw new Error('intentional test error');",
      });
      expectHandlerError(p, "intentional test error");
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// API Discoverability
// =============================================================================

test.describe("Code Mode: API Discoverability", () => {
  test.beforeEach(() => {
    test.setTimeout(90_000);
  });

  test("mysql.help() should return documentation", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: "return mysql.help();",
      });
      expectSuccess(p);
      // help() returns an object with group info
      expect(typeof p.result).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql.core should be accessible", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: "return typeof mysql.core;",
      });
      expectSuccess(p);
      expect(p.result).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql.stats should be accessible", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: "return typeof mysql.stats;",
      });
      expectSuccess(p);
      expect(p.result).toBe("object");
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Security
// =============================================================================

test.describe("Code Mode: Security", () => {
  test("should block require()", async ({}, testInfo) => {
    test.setTimeout(120_000);
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: 'const fs = require("fs"); return fs.readdirSync(".");',
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("should block process access", async ({}, testInfo) => {
    test.setTimeout(120_000);
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: "return process.env;",
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("should block eval()", async ({}, testInfo) => {
    test.setTimeout(120_000);
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: 'return eval("1 + 1");',
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });

  test("should enforce timeout", async ({}, testInfo) => {
    test.setTimeout(120_000);
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: "while (true) {}",
        timeout: 2000,
      });
      expectHandlerError(p);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Readonly Mode
// =============================================================================

test.describe("Code Mode: Readonly Mode", () => {
  test("readonly should allow reads", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          const result = await mysql.core.readQuery({ query: "SELECT COUNT(*) AS cnt FROM test_products" });
          return (result.data?.rows ?? result.rows)[0].cnt;
        `,
        readonly: true,
      });
      expectSuccess(p);
      // PG COUNT returns bigint which may come as string or number
      expect(["number", "string"]).toContain(typeof p.result);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Multi-Step Workflows
// =============================================================================

test.describe("Code Mode: Multi-Step Workflows", () => {
  test("ETL pipeline: create → insert → query → cleanup", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          // Create
          await mysql.core.createTable({
            table: "_e2e_codemode_etl",
            columns: [
              { name: "id", type: "SERIAL", primaryKey: true },
              { name: "name", type: "TEXT" },
              { name: "value", type: "REAL" },
            ],
            ifNotExists: true,
          });

          // Insert
          await mysql.core.writeQuery({
            query: "INSERT INTO _e2e_codemode_etl (name, value) VALUES ('alpha', 10.5), ('beta', 20.3), ('gamma', 30.1)",
          });

          // Query
          const result = await mysql.core.readQuery({
            query: "SELECT name, value FROM _e2e_codemode_etl ORDER BY value DESC",
          });

          // Cleanup
          await mysql.core.dropTable({ table: "_e2e_codemode_etl" });

          return {
            rowCount: (result.data?.rowCount ?? result.rowCount),
            firstItem: (result.data?.rows ?? result.rows)[0]?.name,
          };
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.data?.rowCount ?? result.rowCount).toBe(3);
      expect(result.firstItem).toBe("gamma");
    } finally {
      await client.close();
    }
  });

  test("introspection + query: list tables → describe → query", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          // List tables
          const tables = await mysql.core.listTables({});
          const hasProducts = (tables.data?.tables ?? tables.tables).some(t => t.name === "test_products");

          // Describe
          const desc = await mysql.core.describeTable({ table: "test_products" });

          // Query
          const count = await mysql.core.readQuery({
            query: "SELECT COUNT(*) AS cnt FROM test_products",
          });

          return {
            productsExists: hasProducts,
            columnCount: (desc.data?.columns ?? desc.columns).length,
            rowCount: (count.data?.rows ?? count.rows)[0].cnt,
          };
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.productsExists).toBe(true);
      expect(typeof result.columnCount).toBe("number");
      expect(result.columnCount as number).toBeGreaterThan(0);
      // PG COUNT returns bigint which may come as string or number
      expect(["number", "string"]).toContain(
        typeof (result.data?.rowCount ?? result.rowCount),
      );
    } finally {
      await client.close();
    }
  });

  test("Binary Types: buffer handling and serialization", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          // Create
          await mysql.core.writeQuery({
            query: "CREATE TABLE IF NOT EXISTS _e2e_codemode_binary (id INT AUTO_INCREMENT PRIMARY KEY, bin_col BINARY(4), varbin_col VARBINARY(10), blob_col BLOB)"
          });

          // Insert
          const insertRes = await mysql.core.writeQuery({
            query: "INSERT INTO _e2e_codemode_binary (bin_col, varbin_col, blob_col) VALUES (X'DEADBEEF', X'68656C6C6F2062696E', X'AAAAAAAA')"
          });
          
          const insertId = insertRes.data?.lastInsertId ?? insertRes.data?.insertId ?? 1;

          // Query
          const result = await mysql.core.readQuery({
            query: "SELECT bin_col, varbin_col, blob_col FROM _e2e_codemode_binary WHERE id = ?",
            params: [Number(insertId)]
          });

          // Cleanup
          await mysql.core.writeQuery({ query: "DROP TABLE _e2e_codemode_binary" });

          const row = (result.data?.rows ?? result.rows)[0];
          return {
            hasBinType: row?.bin_col?.type === 'Buffer',
            hasVarBinType: row?.varbin_col?.type === 'Buffer',
            hasBlobType: row?.blob_col?.type === 'Buffer',
            binLength: row?.bin_col?.data?.length,
          };
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.hasBinType).toBe(true);
      expect(result.hasVarBinType).toBe(true);
      expect(result.hasBlobType).toBe(true);
      expect(result.binLength).toBe(4);
    } finally {
      await client.close();
    }
  });
});
