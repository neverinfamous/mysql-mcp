/**
 * Payload Contract Tests: Versioning (OCC)
 *
 * Validates response shapes for the 4 versioning tools:
 * mysql_enable_versioning, mysql_disable_versioning,
 * mysql_check_version, mysql_conditional_update.
 */

import { test, expect } from "@playwright/test";
import { createClient, callToolAndParse } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Versioning", () => {
  let tableName: string;

  test.beforeAll(async () => {
    const client = await createClient();
    try {
      const ts = Date.now();
      tableName = `_e2e_occ_${ts}`;
      await callToolAndParse(client, "mysql_write_query", {
        query: `CREATE TABLE IF NOT EXISTS ${tableName} (id INT PRIMARY KEY, val VARCHAR(100))`,
      });
      await callToolAndParse(client, "mysql_write_query", {
        query: `INSERT INTO ${tableName} (id, val) VALUES (1, 'initial')`,
      });
    } finally {
      await client.close();
    }
  });

  test.afterAll(async () => {
    const client = await createClient();
    try {
      await callToolAndParse(client, "mysql_write_query", {
        query: `DROP TABLE IF EXISTS ${tableName}`,
      });
    } finally {
      await client.close();
    }
  });

  test("mysql_enable_versioning adds _version column and trigger", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_enable_versioning",
        { table: tableName }
      );

      // Skip on read-only servers
      if (payload.success === false) {
        const err = String(payload.error ?? "");
        if (err.includes("read-only") || err.includes("super-read-only") || err.includes("Access denied")) {
          test.skip(true, "Server lacks permissions to modify schema/triggers");
          return;
        }
      }

      expect(payload.success).toBe(true);
      const data = payload.data as any;
      expect(typeof data.message).toBe("string");
      expect(typeof data.alreadyEnabled).toBe("boolean");
    } finally {
      await client.close();
    }
  });

  test("mysql_check_version returns current version", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_check_version", {
        table: tableName,
        rowId: 1,
      });

      expect(payload.success).toBe(true);
      const data = payload.data as any;
      expect(typeof data.version).toBe("number");
      expect(data.version).toBe(1); // Default is 1
      expect(typeof data.row).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_conditional_update succeeds with correct version", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_conditional_update",
        {
          table: tableName,
          data: { val: "updated" },
          conditions: [{ column: "id", value: 1 }],
          expectedVersion: 1,
        }
      );

      expect(payload.success).toBe(true);
      const data = payload.data as any;
      expect(data.rowsAffected).toBe(1);
      expect(data.currentVersion).toBe(2);
    } finally {
      await client.close();
    }
  });

  test("mysql_conditional_update fails with incorrect version (conflict)", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_conditional_update",
        {
          table: tableName,
          data: { val: "hacked" },
          conditions: [{ column: "id", value: 1 }],
          expectedVersion: 1, // Wrong version, it's now 2
        }
      );

      expect(payload.success).toBe(false);
      expect(payload.error).toContain("Version conflict");
    } finally {
      await client.close();
    }
  });

  test("mysql_disable_versioning removes _version column and trigger", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_disable_versioning",
        { table: tableName }
      );

      expect(payload.success).toBe(true);
      const data = payload.data as any;
      expect(typeof data.message).toBe("string");
    } finally {
      await client.close();
    }
  });
});
