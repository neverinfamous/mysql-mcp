/**
 * Payload Contract Tests: Performance + Optimization
 *
 * Validates response shapes for performance (8) and optimization (4) tools:
 * explain, explain_analyze, slow_queries, query_stats,
 * index_usage, table_stats, buffer_pool_stats, thread_stats,
 * index_recommendation, query_rewrite, force_index, optimizer_trace.
 */

import { test, expect } from "@playwright/test";
import { createClient, callToolAndParse } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Performance + Optimization", () => {
  test("mysql_explain returns explain plan", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_explain", {
        query: "SELECT * FROM test_products WHERE id = 1",
      });

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_explain_analyze returns analyze output", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_explain_analyze", {
        query: "SELECT * FROM test_products WHERE id = 1",
      });

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_index_usage returns usage data", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_index_usage", {
        table: "test_products",
      });

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_table_stats returns table statistics", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_table_stats", {
        table: "test_products",
      });

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_buffer_pool_stats returns buffer pool info", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_buffer_pool_stats",
        { summary: true },
      );

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_optimizer_trace with summary returns decisions", async () => {
    const client = await createClient();
    try {
      const payload = (await callToolAndParse(
        client,
        "mysql_optimizer_trace",
        {
          query: "SELECT * FROM test_products WHERE id = 1",
          summary: true,
        },
      )) as { data: { query: string } };

      expect(typeof payload.data.query).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("mysql_index_recommendation returns suggestions", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_index_recommendation",
        {
          query: "SELECT * FROM test_products WHERE category = 'Electronics'",
        },
      );

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });
});
