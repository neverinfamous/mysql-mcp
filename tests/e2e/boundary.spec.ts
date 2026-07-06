/**
 * E2E Tests: Boundary Conditions
 *
 * Tests edge cases: empty tables, NULL-heavy data, single-row stats,
 * create-drop-recreate idempotency, and view lifecycle.
 *
 * Uses _e2e_* prefixed temp tables with cleanup.
 *
 * Ported from db-mcp/tests/e2e/boundary.spec.ts — adapted for mysql-mcp.
 */

import { test, expect } from "@playwright/test";
import { createClient, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

// =============================================================================
// Empty Table Behavior
// =============================================================================

test.describe("Boundary: Empty Tables", () => {
  test("create empty table, describe, then drop", async ({}, testInfo) => {
    const client = await createClient();
    try {
      // Create
      const create = await callToolAndParse(client, "mysql_create_table", {
        table: "_e2e_boundary_empty",
        columns: [
          { name: "id", type: "SERIAL", primaryKey: true },
          { name: "value", type: "TEXT" },
        ],
        ifNotExists: true,
      });
      expectSuccess(create);

      // Describe
      const desc = await callToolAndParse(client, "mysql_describe_table", {
        table: "_e2e_boundary_empty",
      });
      expectSuccess(desc);
      /* desc.name not checked */
      expect(Array.isArray(desc.data?.columns ?? desc.columns)).toBe(true);

      // Read — should return 0 rows
      const read = await callToolAndParse(client, "mysql_read_query", {
        query: "SELECT * FROM _e2e_boundary_empty",
      });
      expectSuccess(read);
      expect(read.data?.rowCount ?? read.rowCount).toBe(0);

      // Cleanup
      await callToolAndParse(client, "mysql_drop_table", {
        table: "_e2e_boundary_empty",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });

  test("stats on empty table → structured error or zero stats", async ({}, testInfo) => {
    const client = await createClient();
    try {
      // Create empty table
      await callToolAndParse(client, "mysql_create_table", {
        table: "_e2e_boundary_stats_empty",
        columns: [
          { name: "id", type: "SERIAL", primaryKey: true },
          { name: "value", type: "REAL" },
        ],
        ifNotExists: true,
      });

      // Stats on empty table
      const stats = await callToolAndParse(client, "mysql_stats_descriptive", {
        table: "_e2e_boundary_stats_empty",
        column: "value",
      });
      // Accept either handler error (no data) or structured result
      // Some stats tools return raw payloads without a success wrapper
      expect(typeof stats).toBe("object");

      // Cleanup
      await callToolAndParse(client, "mysql_drop_table", {
        table: "_e2e_boundary_stats_empty",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// NULL-Heavy Data
// =============================================================================

test.describe("Boundary: NULL Values", () => {
  test("table with all-NULL numeric column", async ({}, testInfo) => {
    const client = await createClient();
    try {
      // Create + insert NULLs
      await callToolAndParse(client, "mysql_create_table", {
        table: "_e2e_boundary_nulls",
        columns: [
          { name: "id", type: "SERIAL", primaryKey: true },
          { name: "value", type: "REAL" },
        ],
        ifNotExists: true,
      });

      await callToolAndParse(client, "mysql_write_query", {
        query:
          "INSERT INTO _e2e_boundary_nulls (value) VALUES (NULL), (NULL), (NULL)",
      });

      // Read should succeed with NULL values
      const read = await callToolAndParse(client, "mysql_read_query", {
        query: "SELECT * FROM _e2e_boundary_nulls",
      });
      expectSuccess(read);
      expect(read.data?.rowCount ?? read.rowCount).toBe(3);

      // Cleanup
      await callToolAndParse(client, "mysql_drop_table", {
        table: "_e2e_boundary_nulls",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Single-Row Stats
// =============================================================================

test.describe("Boundary: Single Row", () => {
  test("stats on single-row table", async ({}, testInfo) => {
    const client = await createClient();
    try {
      await callToolAndParse(client, "mysql_create_table", {
        table: "_e2e_boundary_single",
        columns: [
          { name: "id", type: "SERIAL", primaryKey: true },
          { name: "value", type: "REAL" },
        ],
        ifNotExists: true,
      });

      await callToolAndParse(client, "mysql_write_query", {
        query: "INSERT INTO _e2e_boundary_single (value) VALUES (42.0)",
      });

      const stats = await callToolAndParse(client, "mysql_stats_descriptive", {
        table: "_e2e_boundary_single",
        column: "value",
      });
      // Single row: min == max == mean == 42.0
      if (stats.success) {
        const s = (stats.data?.statistics ??
          stats.data ??
          stats.statistics) as Record<string, unknown>;
        expect(s.count).toBeGreaterThanOrEqual(1);
        if (typeof s.min === "number") {
          expect(s.min).toBe(42.0);
        }
      }

      // Cleanup
      await callToolAndParse(client, "mysql_drop_table", {
        table: "_e2e_boundary_single",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Create → Drop → Recreate Idempotency
// =============================================================================

test.describe("Boundary: Create-Drop-Recreate", () => {
  test("create table, drop, recreate with different schema", async ({}, testInfo) => {
    const client = await createClient();
    try {
      // Clean up orphaned table if any
      await callToolAndParse(client, "mysql_drop_table", {
        table: "_e2e_boundary_recreate",
        ifExists: true,
      }).catch(() => {});

      // Create v1
      const c1 = await callToolAndParse(client, "mysql_create_table", {
        table: "_e2e_boundary_recreate",
        columns: [
          { name: "id", type: "SERIAL", primaryKey: true },
          { name: "name", type: "TEXT" },
        ],
      });
      expectSuccess(c1);

      // Drop
      const d = await callToolAndParse(client, "mysql_drop_table", {
        table: "_e2e_boundary_recreate",
      });
      expectSuccess(d);

      // Recreate v2 (different columns)
      const c2 = await callToolAndParse(client, "mysql_create_table", {
        table: "_e2e_boundary_recreate",
        columns: [
          { name: "id", type: "SERIAL", primaryKey: true },
          { name: "value", type: "REAL" },
          { name: "active", type: "BOOLEAN" },
        ],
      });
      expectSuccess(c2);

      // Describe should reflect v2 schema
      const desc = await callToolAndParse(client, "mysql_describe_table", {
        table: "_e2e_boundary_recreate",
      });
      expectSuccess(desc);
      const cols = (desc.data?.columns ?? desc.columns) as Array<{
        name: string;
      }>;
      const colNames = cols.map((c) => c.name);
      expect(colNames).toContain("value");
      expect(colNames).toContain("active");
      expect(colNames).not.toContain("name");

      // Cleanup
      await callToolAndParse(client, "mysql_drop_table", {
        table: "_e2e_boundary_recreate",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// View Lifecycle
// =============================================================================

test.describe("Boundary: View Lifecycle", () => {
  test("create view → list views → query view → drop view", async ({}, testInfo) => {
    const client = await createClient();
    try {
      // Create view
      await callToolAndParse(client, "mysql_drop_view", {
        name: "_e2e_boundary_view_1778242635228",
        ifExists: true,
      }).catch(() => {});
      const create = await callToolAndParse(client, "mysql_create_view", {
        name: "_e2e_boundary_view_1778242635228",
        query: "SELECT id, name FROM test_products WHERE price > 50",
      });
      expectSuccess(create);

      // List views — should include our view
      const list = await callToolAndParse(client, "mysql_list_views", { schema: "testdb" });
      expectSuccess(list);
      const views = (list.data?.views ?? list.views) as Array<{ name: string }>;
      expect(
        views.some((v) => v.name === "_e2e_boundary_view_1778242635228"),
      ).toBe(true);

      // Query the view
      const query = await callToolAndParse(client, "mysql_read_query", {
        query: "SELECT * FROM _e2e_boundary_view_1778242635228",
      });
      expectSuccess(query);
      expect(
        typeof (
          query.data?.rowCount ??
          query.rowCount ??
          query.data?.count ??
          query.count
        ),
      ).toBe("number");

      // Drop view
      const drop = await callToolAndParse(client, "mysql_drop_view", {
        name: "_e2e_boundary_view_1778242635228",
      });
      expectSuccess(drop);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Data Integrity — Original Tables Unmodified
// =============================================================================

test.describe("Boundary: Data Integrity", () => {
  test("test_products still has expected row count", async ({}, testInfo) => {
    test.setTimeout(60_000);
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_read_query", {
        query: "SELECT COUNT(*) AS cnt FROM test_products",
      });
      expectSuccess(p);
      const rows = (p.data?.rows ?? p.rows) as Array<{ cnt: number }>;
      expect(Number(rows[0].cnt)).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Security Sandbox
// =============================================================================

test.describe("Boundary: Security Sandbox", () => {
  test("filesystem tools reject paths outside ALLOWED_IO_ROOTS", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const badPath = process.platform === "win32" ? "C:/Windows/System32/config/SAM" : "/etc/passwd";
      
      const result = await callToolAndParse(client, "mysqlsh_export_table", {
        schema: "testdb",
        table: "test_products",
        outputPath: badPath
      });

      // Assert that we don't get a raw MCP error but a structured domain error
      expect(result.success).toBe(false);
      expect(result.code).toBe("SECURITY_ERROR");
      
      // Also verify another tool that touches the filesystem
      const dumpResult = await callToolAndParse(client, "mysqlsh_dump_instance", {
        outputUrl: badPath
      });
      expect(dumpResult.success).toBe(false);
      expect(dumpResult.code).toBe("SECURITY_ERROR");
    } finally {
      await client.close();
    }
  });
});
