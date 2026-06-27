/**
 * E2E Tests: Code Mode Tool Groups
 *
 * Exercises key tool groups through the mysql.* Code Mode API to verify
 * that each group is accessible and functional.
 *
 * Ported from db-mcp/tests/e2e/codemode-groups.spec.ts — adapted for mysql-mcp's 22 groups.
 */

import { test, expect } from "@playwright/test";
import { createClient, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

// =============================================================================
// Core Group
// =============================================================================

test.describe("Code Mode Groups: Core", () => {
  test("mysql.core.listTables()", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          const result = await mysql.core.listTables({});
          return { tableCount: (result.data?.tables ?? result.tables).length };
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(typeof result.tableCount).toBe("number");
      expect(result.tableCount as number).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("mysql.core.readQuery()", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          const result = await mysql.core.readQuery({ query: "SELECT 1 + 1 AS sum" });
          return (result.data?.rows ?? result.rows)[0].sum;
        `,
      });
      expectSuccess(p);
      expect(p.result).toBe(2);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// JSONB Group
// =============================================================================

test.describe("Code Mode Groups: JSONB", () => {
  test("mysql.json.extract()", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          const result = await mysql.json.extract({ table: 'test_products', column: 'metadata', path: '$.category' });
          return result;
        `,
      });
      expectSuccess(p);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Performance Group
// =============================================================================

test.describe("Code Mode Groups: Performance", () => {
  test("mysql.performance.explain()", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          const result = await mysql.performance.explain({ query: "SELECT * FROM test_products" });
          return { hasPlan: !!(result.data?.plan ?? result.plan) };
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.hasPlan).toBe(true);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Introspection Group
// =============================================================================

test.describe("Code Mode Groups: Introspection", () => {
  test("mysql.introspection.schemaSnapshot()", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          const result = await mysql.introspection.schemaSnapshot({ schema: 'testdb' });
          return { hasTables: Array.isArray((result.data?.snapshot ?? result.snapshot)?.tables ?? (result.data?.tables ?? result.tables)) };
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.hasTables).toBe(true);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Migration Group
// =============================================================================

test.describe("Code Mode Groups: Migration", () => {
  test("mysql.migration.history()", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          const result = await mysql.migration.history({});
          return { success: (result.success ?? result.data?.success ?? true) };
        `,
      });
      expectSuccess(p);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Schema Group
// =============================================================================

test.describe("Code Mode Groups: Schema", () => {
  test("mysql.schema.listViews()", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          const result = await mysql.schema.listViews({});
          return { success: (result.success ?? result.data?.success ?? true) };
        `,
      });
      expectSuccess(p);
    } finally {
      await client.close();
    }
  });
});
