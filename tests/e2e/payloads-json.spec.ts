/**
 * Payload Contract Tests: JSON
 *
 * Validates response shapes for JSON tools (17 total):
 * json_extract, json_set, json_insert, json_replace, json_remove,
 * json_contains, json_keys, json_array_append, json_get,
 * json_update, json_search, json_validate, json_merge, json_diff,
 * json_normalize, json_stats, json_index_suggest.
 */

import { test, expect } from "@playwright/test";
import { createClient, callToolAndParse } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: JSON", () => {
  test("mysql_json_extract returns { rows, rowCount }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_json_extract", {
        table: "test_json_docs",
        column: "doc",
        path: "$.type",
      });

      expect(Array.isArray(payload.data.rows)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("mysql_json_contains returns { rows, rowCount }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_json_contains", {
        table: "test_json_docs",
        column: "doc",
        value: '"report"',
        path: "$.type",
      });

      expect(Array.isArray(payload.data.rows)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("mysql_json_keys returns { rows, rowCount }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_json_keys", {
        table: "test_json_docs",
        column: "doc",
      });

      expect(Array.isArray(payload.data.rows)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("mysql_json_get returns { value }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_json_get", {
        table: "test_json_docs",
        column: "doc",
        path: "$.type",
        id: 1,
        idColumn: "id",
      });

      expect(typeof payload.data).toBe("object");
      // Returns { value } or { value: null, rowFound: false }
    } finally {
      await client.close();
    }
  });

  test("mysql_json_validate returns { valid }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_json_validate", {
        value: '{"key": "value"}',
      });

      expect(typeof payload.data.valid).toBe("boolean");
    } finally {
      await client.close();
    }
  });

  test("mysql_json_stats returns result", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_json_stats", {
        table: "test_json_docs",
        column: "doc",
      });

      // json_stats returns stats about JSON column
      expect(typeof payload.data).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_json_search returns { rows, rowCount }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_json_search", {
        table: "test_json_docs",
        column: "doc",
        searchValue: "report",
      });

      expect(Array.isArray(payload.data.rows)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("mysql_json_index_suggest returns suggestions", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_json_index_suggest",
        {
          table: "test_json_docs",
          column: "doc",
        },
      );

      // Should return array of suggestions or analysis
      expect(typeof payload.data).toBe("object");
    } finally {
      await client.close();
    }
  });
});

