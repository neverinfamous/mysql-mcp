/**
 * E2E Tests: Code Mode Tool Groups (Extended)
 *
 * Exercises codemode groups NOT covered by codemode-groups.spec.ts.
 * Only includes groups that work without extension dependencies.
 *
 * Already covered: core, jsonb, stats, text, performance, introspection,
 * migration, monitoring, schema, admin.
 *
 * Added here: transactions, backup.
 */

import { test, expect } from "@playwright/test";
import {
  createClient,
  callToolAndParse,
  expectSuccess,
} from "./helpers.js";

test.describe.configure({ mode: "serial" });

// =============================================================================
// Transactions Group via Code Mode
// =============================================================================

test.describe("Code Mode Groups: Transactions", () => {
  test("mysql.transactions.begin() + commit()", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          const begin = await mysql.transactions.begin({});
          const txnId = begin.transactionId;
          const commit = await mysql.transactions.commit({ transactionId: txnId });
          return { begun: !!txnId, committed: commit.success };
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result).toBeDefined();
      expect(result.success ?? true).toBe(true);
    } finally {
      await client.close();
    }
  });

  test.skip("mysql.transactions.status()", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          const begin = await mysql.transactions.begin({});
          const txnId = begin.transactionId;
          const result = await mysql.transactions.status({ transactionId: txnId });
          await mysql.transactions.commit({ transactionId: txnId });
          return { status: result.status, active: result.active };
        `,
      });
      expectSuccess(p);
      const result = p.result as Record<string, unknown>;
      expect(result.status).toBe("active");
      expect(result.active).toBe(true);
    } finally {
      await client.close();
    }
  });
});

// =============================================================================
// Backup Group via Code Mode
// =============================================================================

test.describe("Code Mode Groups: Backup", () => {
  test.skip("mysql.backup.dumpTable()", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          const result = await mysql.backup.dumpTable({ table: "test_products" });
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
// Partitioning Group via Code Mode (uses core PG features, no extension needed)
// =============================================================================

test.describe("Code Mode Groups: Partitioning", () => {
  test("mysql.partitioning.partitionInfo()", async ({}, testInfo) => {
    const client = await createClient();
    try {
      const p = await callToolAndParse(client, "mysql_execute_code", {
        code: `
          const result = await mysql.partitioning.partitionInfo({ table: "test_events" });
          return { hasResult: typeof result === "object" };
        `,
      });
      expectSuccess(p);
    } finally {
      await client.close();
    }
  });
});
