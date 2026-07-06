/**
 * Cross-Group Integration Workflow Tests
 *
 * Exercises realistic multi-group workflows that span tool boundaries
 * to catch inter-group regressions.
 *
 * Workflow 1: Core → JSON → Stats (Data Pipeline)
 * Workflow 2: Admin → Introspection (Health Check Pipeline)
 * Workflow 3: Core + Stats Cross-Validation
 *
 * All workflows use code mode for multi-step orchestration.
 * Uses _e2e_integration_* prefixed temp tables with cleanup.
 *
 * Ported from db-mcp/tests/e2e/integration-workflows.spec.ts — adapted for mysql-mcp.
 */

import { test, expect } from "@playwright/test";
import { createClient, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

// =============================================================================
// Workflow 1: Core → JSON → Stats (Data Pipeline)
// =============================================================================

test.describe("Integration: Core → JSON → Stats Pipeline", () => {
  test("create table, insert JSON data, extract + analyze", async ({}, testInfo) => {
    const client = await createClient();
    try {
      // Step 1: Create table
      const create = await callToolAndParse(client, "mysql_create_table", {
        table: "_e2e_integration_pipeline",
        columns: [
          { name: "id", type: "SERIAL", primaryKey: true },
          { name: "data", type: "JSON" },
          { name: "score", type: "REAL" },
        ],
        ifNotExists: true,
      });
      expectSuccess(create);

      // Step 2: Insert JSON + numeric data
      const insert = await callToolAndParse(client, "mysql_write_query", {
        query: `INSERT INTO _e2e_integration_pipeline (data, score) VALUES
          ('{"category": "A", "value": 42}', 85.5),
          ('{"category": "B", "value": 17}', 92.3),
          ('{"category": "A", "value": 88}', 71.0),
          ('{"category": "B", "value": 55}', 63.8),
          ('{"category": "A", "value": 31}', 99.1)`,
      });
      expectSuccess(insert);

      // Step 3: Cross-group — JSON extract
      const extracted = await callToolAndParse(client, "mysql_json_extract", {
        table: "_e2e_integration_pipeline",
        column: "data",
        path: "$.category",
      });
      expectSuccess(extracted);

      // Step 4: Cross-group — Stats descriptive
      const stats = await callToolAndParse(client, "mysql_stats_descriptive", {
        table: "_e2e_integration_pipeline",
        column: "score",
      });
      expectSuccess(stats);
      const s = (stats.data?.statistics ??
        stats.data ??
        stats.statistics ??
        stats.stats) as Record<string, unknown> | undefined;
      expect(s).toBeDefined();
      expect(s!.count as number).toBeGreaterThanOrEqual(5);
      expect(typeof s!.min).toBe("number");
      expect(typeof s!.max).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("cleanup: drop pipeline table", async ({}, testInfo) => {
    const client = await createClient();
    try {
      await callToolAndParse(client, "mysql_drop_table", {
        table: "_e2e_integration_pipeline",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Workflow 2: Admin → Introspection Health Check (via Code Mode)
// =============================================================================

test.describe("Integration: Admin → Introspection Health Check", () => {
  test("schema snapshot → explain → list constraints", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          // Step 1: Schema snapshot
          const snapshot = await mysql.introspection.schemaSnapshot({ schema: 'testdb' });

          // Step 2: Explain a complex join
          const plan = await mysql.performance.explain({
            query: "SELECT p.name, COUNT(o.id) as order_count FROM test_products p LEFT JOIN test_orders o ON o.product_id = p.id GROUP BY p.name",
          });

          // Step 3: List constraints
          const constraints = await mysql.schema.listConstraints({ table: "test_products" });

          return {
            tableCount: (snapshot.data?.snapshot?.tables ?? snapshot.data?.tables ?? snapshot.snapshot?.tables ?? snapshot.tables)?.length ?? 0,
            hasPlan: !!(plan.data?.plan ?? plan.data?.executionPlan ?? plan.plan ?? plan.data),
            constraintCount: constraints.constraints?.length ?? 0,
          };
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(typeof result.tableCount).toBe("number");
      expect(result.tableCount as number).toBeGreaterThan(0);
      expect(result.hasPlan).toBe(true);
    } finally {
      await client.close();
    }
  });
});
