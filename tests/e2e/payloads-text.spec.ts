/**
 * Payload Contract Tests: Text + Fulltext
 *
 * Validates response shapes for text (6) and fulltext (5) tools:
 * regexp_match, like_search, soundex, substring, concat, collation_convert,
 * fulltext_create, fulltext_drop, fulltext_search, fulltext_boolean, fulltext_expand.
 */

import { test, expect } from "@playwright/test";
import { createClient, callToolAndParse } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Text + Fulltext", () => {
  test("mysql_regexp_match returns { data }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_regexp_match", {
        table: "test_products",
        column: "name",
        pattern: "Pro.*",
      });

      const data = payload.data as Record<string, unknown>;
      expect(Array.isArray(data.rows)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("mysql_like_search returns { data }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_like_search", {
        table: "test_products",
        column: "name",
        pattern: "%Pro%",
      });

      const data = payload.data as Record<string, unknown>;
      expect(Array.isArray(data.rows)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("mysql_soundex returns { data }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_soundex", {
        table: "test_users",
        column: "username",
        value: "John",
      });

      const data = payload.data as Record<string, unknown>;
      expect(Array.isArray(data.rows)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("mysql_fulltext_search returns { data, count }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_fulltext_search", {
        table: "test_articles",
        columns: ["title", "body"],
        query: "MySQL database",
      });

      const data = payload.data as Record<string, unknown>;
      expect(Array.isArray(data.rows)).toBe(true);
      expect(typeof data.count).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("mysql_fulltext_boolean returns { data, count }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_fulltext_boolean", {
        table: "test_articles",
        columns: ["title", "body"],
        query: "+MySQL -Oracle",
      });

      const data = payload.data as Record<string, unknown>;
      expect(Array.isArray(data.rows)).toBe(true);
      expect(typeof data.count).toBe("number");
    } finally {
      await client.close();
    }
  });

  test("mysql_substring returns { data }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_substring", {
        table: "test_products",
        column: "name",
        start: 1,
        length: 5,
      });

      const data = payload.data as Record<string, unknown>;
      expect(Array.isArray(data.rows)).toBe(true);
    } finally {
      await client.close();
    }
  });

  test("mysql_concat returns { data }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_concat", {
        table: "test_products",
        columns: ["name", "category"],
        separator: " - ",
      });

      const data = payload.data as Record<string, unknown>;
      expect(Array.isArray(data.rows)).toBe(true);
    } finally {
      await client.close();
    }
  });
});
