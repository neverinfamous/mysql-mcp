/**
 * Payload Contract Tests: Schema
 *
 * Validates response shapes for schema tools (12):
 * list_schemas, create_schema, drop_schema,
 * list_views, create_view, drop_view,
 * list_stored_procedures, list_functions,
 * list_triggers, create_trigger, drop_trigger,
 * list_constraints.
 */

import { test, expect } from "@playwright/test";
import {
  createClient,
  callToolAndParse,
  expectSuccess,
  skipIfSuperReadOnly,
} from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Schema", () => {
  test("mysql_list_schemas returns { schemas[] }", async () => {
    const client = await createClient();
    try {
      const payload = await callToolAndParse(client, "mysql_list_schemas", {});

      expect(Array.isArray((payload as Record<string, unknown>).data?.schemas)).toBe(true);
      expect(
        ((payload as Record<string, unknown>).data?.schemas as unknown[]).length,
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

  test("mysql_create_trigger returns { triggerName }", async () => {
    const client = await createClient();
    await skipIfSuperReadOnly(client);
    try {
      const payload = await callToolAndParse(client, "mysql_create_trigger", {
        name: "test_trg_e2e",
        table: "test_orders",
        timing: "BEFORE",
        event: "INSERT",
        body: "SET NEW.total_price = COALESCE(NEW.total_price, 0)",
      });
      expectSuccess(payload);
      expect((payload as Record<string, unknown>).data?.triggerName).toBeDefined();
      
      // Cleanup
      await callToolAndParse(client, "mysql_drop_trigger", {
        name: "test_trg_e2e",
        ifExists: true,
      });
    } finally {
      await client.close();
    }
  });

  test("mysql_drop_trigger returns result", async () => {
    const client = await createClient();
    try {
      // Drop nonexistent with ifExists should succeed with skipped
      const payload = await callToolAndParse(client, "mysql_drop_trigger", {
        name: "nonexistent_trigger_e2e",
        ifExists: true,
      });
      expectSuccess(payload);
      expect((payload as Record<string, unknown>).data?.skipped).toBe(true);
    } finally {
      await client.close();
    }
  });
});
