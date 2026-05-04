/**
 * Payload Contract Tests: Core
 *
 * Validates response shapes for the 8 core tools:
 * read_query, write_query, list_tables, describe_table,
 * create_table, drop_table, get_indexes, create_index.
 */

import { test, expect } from "@playwright/test";
import { createClient, callToolAndParse } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Core", () => {
  test("mysql_list_tables returns { tables[], count }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_list_tables", {});

      const data = payload.data as any;
      expect(Array.isArray(data.tables)).toBe(true);
      expect(typeof data.count).toBe("number");

      const tables = data.tables as Record<string, unknown>[];
      expect(tables.length).toBeGreaterThan(0);
      expect(typeof tables[0].name).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("mysql_read_query returns { rows[], rowCount }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_read_query", {
        query: "SELECT id, name FROM test_products LIMIT 3",
      });

      const data = payload.data as any;
      expect(Array.isArray(data.rows)).toBe(true);
      expect(typeof data.rowCount).toBe("number");
      expect(data.rowCount).toBe(3);
    } finally {
      await client.close();
    }
  });

  test("mysql_describe_table returns { columns[], exists }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_describe_table", {
        table: "test_products",
      });

      const data = payload.data as any;
      expect(data.exists).toBe(true);
      expect(Array.isArray(data.columns)).toBe(true);

      const cols = data.columns as Record<string, unknown>[];
      expect(cols.length).toBeGreaterThan(0);
      expect(typeof cols[0].name).toBe("string");
    } finally {
      await client.close();
    }
  });

  test("mysql_get_indexes returns { indexes[], exists }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_get_indexes", {
        table: "test_products",
      });

      const data = payload.data as any;
      expect(data.exists).toBe(true);
      expect(Array.isArray(data.indexes)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("mysql_write_query returns { rowsAffected }", async () => {
    const client = await createClient();
    try {
      // Setup: create temp table
      const setup = await callToolAndParse(client, "mysql_write_query", {
        query:
          "CREATE TABLE IF NOT EXISTS _e2e_payload_test (id INT PRIMARY KEY, val VARCHAR(100))",
      });

      // Skip on read-only servers (e.g. --super-read-only replicas)
      if (setup.success === false) {
        const err = String(setup.error ?? "");
        if (err.includes("read-only") || err.includes("super-read-only")) {
          test.skip(true, "Server is read-only — write_query requires write access");
          return;
        }
      }

      const payload = await callToolAndParse(client, "mysql_write_query", {
        query:
          "INSERT INTO _e2e_payload_test (id, val) VALUES (1, 'test') ON DUPLICATE KEY UPDATE val = 'test'",
      });

      const data = payload.data as any;
      expect(typeof data.rowsAffected).toBe("number");

      // Cleanup
      await callToolAndParse(client, "mysql_write_query", {
        query: "DROP TABLE IF EXISTS _e2e_payload_test",
      });
    } finally {
      await client.close();
    }
  });

  test("mysql_create_table + drop_table lifecycle", async () => {
    const client = await createClient();
    try {
      const ts = Date.now();
      const tableName = `_e2e_ct_${ts}`;

      const createPayload = await callToolAndParse(
        client,
        "mysql_create_table",
        {
          name: tableName,
          columns: [
            { name: "id", type: "INT", primaryKey: true, autoIncrement: true },
            { name: "val", type: "VARCHAR(100)" },
          ],
        },
      );

      // Skip on read-only servers
      if (createPayload.success === false) {
        const err = String(createPayload.error ?? "");
        if (err.includes("read-only") || err.includes("super-read-only")) {
          test.skip(true, "Server is read-only — create_table requires write access");
          return;
        }
      }

      expect(createPayload.success).toBe(true);
      expect((createPayload.data as any).tableName).toBe(tableName);

      const dropPayload = await callToolAndParse(client, "mysql_drop_table", {
        table: tableName,
      });

      expect(dropPayload.success).toBe(true);
      expect((dropPayload.data as any).tableName).toBe(tableName);
    } finally {
      await client.close();
    }
  });

  test("mysql_create_index + get_indexes validates shape", async () => {
    const client = await createClient();
    try {
      const ts = Date.now();
      const tableName = `_e2e_idx_${ts}`;

      const tablePayload = await callToolAndParse(client, "mysql_create_table", {
        name: tableName,
        columns: [
          { name: "id", type: "INT", primaryKey: true },
          { name: "name", type: "VARCHAR(100)" },
        ],
      });

      // Skip on read-only servers
      if (tablePayload.success === false) {
        const err = String(tablePayload.error ?? "");
        if (err.includes("read-only") || err.includes("super-read-only")) {
          test.skip(true, "Server is read-only — create_index requires write access");
          return;
        }
      }

      const idxPayload = await callToolAndParse(client, "mysql_create_index", {
        name: `idx_${ts}`,
        table: tableName,
        columns: ["name"],
      });

      expect(idxPayload.success).toBe(true);
      expect(typeof (idxPayload.data as any).indexName).toBe("string");

      // Cleanup
      await callToolAndParse(client, "mysql_drop_table", {
        table: tableName,
      });
    } finally {
      await client.close();
    }
  });

  test("mysql_read_query error returns { success: false, error }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_read_query", {
        query: "SELECT * FROM nonexistent_table_xyz",
      });

      expect(payload.success).toBe(false);
      expect(typeof payload.error).toBe("string");
    } finally {
      await client.close();
    }
  });
});
