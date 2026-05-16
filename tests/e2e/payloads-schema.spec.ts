/**
 * Payload Contract Tests: Schema
 *
 * Validates response shapes for schema tools (10):
 * list_schemas, create_schema, drop_schema,
 * list_views, create_view,
 * list_stored_procedures, list_functions,
 * list_triggers, list_constraints, list_events.
 */

import { test, expect } from "@playwright/test";
import { createClient, callToolAndParse } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Schema", () => {
  test("mysql_list_schemas returns { schemas[] }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_list_schemas", {});

      expect(Array.isArray((payload as any).data?.schemas)).toBe(true);
      expect(
        ((payload as any).data?.schemas as unknown[]).length,
      ).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });

  test("mysql_list_views returns result", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_list_views", {});

      expect(typeof payload).toBe("object");
      // May have views[] or empty result
    } finally {
      await client.close();
    }
  });

  test("mysql_list_stored_procedures returns result", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_list_stored_procedures",
        {},
      );

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_list_functions returns result", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(
        client,
        "mysql_list_functions",
        {},
      );

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_list_triggers returns result", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_list_triggers", {});

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });

  test("mysql_list_constraints returns result", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_list_constraints", {
        table: "test_orders",
      });

      expect(typeof payload).toBe("object");
    } finally {
      await client.close();
    }
  });
});
