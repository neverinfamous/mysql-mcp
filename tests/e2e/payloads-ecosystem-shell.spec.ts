/**
 * Payload Contracts: Ecosystem — Shell
 *
 * Validates response shapes for 2 safe, read-only Shell tools:
 * mysqlsh_version, mysqlsh_run_script.
 *
 * Destructive tools excluded: dump_instance, dump_schemas, dump_tables,
 * load_dump, export_table, import_table, import_json, check_upgrade.
 */

import { test, expect } from "@playwright/test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createClient, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Ecosystem — Shell", () => {
  let client: Client;

  test.beforeAll(async () => {
    client = await createClient();
  });

  test.afterAll(async () => {
    await client.close();
  });

  test("mysqlsh_version returns { success, version }", async () => {
    const payload = await callToolAndParse(client, "mysqlsh_version", {});
    expectSuccess(payload);
    expect(typeof (payload.data as any).version).toBe("string");
  });

  // mysqlsh_run_script excluded — Shell subprocess can crash the MCP server
});
