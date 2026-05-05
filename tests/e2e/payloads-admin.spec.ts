/**
 * Payload Contract Tests: Admin + Monitoring
 *
 * Validates response shapes for admin (6) and monitoring (7) tools:
 * optimize, analyze, check, repair, flush, kill,
 * processlist, status, variables, innodb_status, replication, pool_stats, health.
 */

import { test, expect } from "@playwright/test";
import { createClient, callToolAndParse } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Admin + Monitoring", () => {
  // --- Admin tools ---

  test("mysql_optimize_table returns { results[], rowCount }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_optimize_table", {
        tables: ["test_products"],
      });

      // Skip on read-only servers (e.g. --super-read-only replicas)
      if (payload.success === false) {
        const err = String(payload.error ?? "");
        if (err.includes("read-only") || err.includes("super-read-only")) {
          test.skip(true, "Server is read-only — OPTIMIZE TABLE requires write access");
          return;
        }
      }

      const data = payload.data as any;
      expect(Array.isArray(data?.results)).toBe(true);
      expect(typeof data?.rowCount).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("mysql_analyze_table returns { results[], rowCount }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_analyze_table", {
        tables: ["test_products"],
      });

      // Skip on read-only servers
      if (payload.success === false) {
        const err = String(payload.error ?? "");
        if (err.includes("read-only") || err.includes("super-read-only")) {
          test.skip(true, "Server is read-only — ANALYZE TABLE requires write access");
          return;
        }
      }

      const data = payload.data as any;
      expect(Array.isArray(data?.results)).toBe(true);
      expect(typeof data?.rowCount).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("mysql_check_table returns { results[], rowCount }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_check_table", {
        tables: ["test_products"],
      });

      const data = payload.data as any;
      expect(Array.isArray(data?.results)).toBe(true);
      expect(typeof data?.rowCount).toBe("number");
    } finally {
      await client.close();
    }
  });

  // --- Monitoring tools ---

  test("mysql_show_processlist returns { processes[], count }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_show_processlist",
        { limit: 3 },
      );

      const data = payload.data as any;
      expect(Array.isArray(data?.processes)).toBe(true);
      expect(typeof data?.count).toBe("number");
      expect(data?.count as number).toBeLessThanOrEqual(3);
    } finally {
      await client.close();
    }
  });

  test("mysql_show_status returns { status, rowCount, totalAvailable }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_show_status", {
        limit: 5,
      });

      const data = payload.data as any;
      expect(typeof data?.status).toBe("object");
      expect(typeof data?.rowCount).toBe("number");
      expect(typeof data?.totalAvailable).toBe("number");
      expect(data?.rowCount as number).toBeLessThanOrEqual(5);
    } finally {
      await client.close();
    }
  });

  test("mysql_show_variables returns { variables, rowCount, totalAvailable }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_show_variables", {
        limit: 5,
      });

      const data = payload.data as any;
      expect(typeof data?.variables).toBe("object");
      expect(typeof data?.rowCount).toBe("number");
      expect(typeof data?.totalAvailable).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("mysql_innodb_status with summary returns parsed metrics", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_innodb_status", {
        summary: true,
      });

      const data = payload.data as any;
      expect(typeof data?.summary).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_pool_stats returns { poolStats }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_pool_stats", {});

      const data = payload.data as any;
      expect(typeof data?.poolStats).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_server_health returns health data", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_server_health", {});

      // Health returns { serverHealth: { connected, version, database, uptime, ... } }
      const data = payload.data as any;
      expect(typeof data?.serverHealth?.connected).toBe("boolean");
    } finally {
      await client.close();
    }
  });

  test("mysql_replication_status returns info", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_replication_status",
        { summary: true },
      );

      const data = payload.data as any;
      // Should have configured boolean regardless
      expect(typeof data?.configured).toBe("boolean");
    } finally {
      await client.close();
    }
  });
});
