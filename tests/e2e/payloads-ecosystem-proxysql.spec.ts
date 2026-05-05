/**
 * Payload Contracts: Ecosystem — ProxySQL
 *
 * Validates response shapes for 6 untested ProxySQL tools:
 * proxysql_runtime_status, proxysql_memory_stats, proxysql_users,
 * proxysql_query_rules, proxysql_query_digest, proxysql_process_list.
 *
 * (5 other ProxySQL tools already covered in ecosystem.spec.ts)
 * proxysql_commands excluded — mutating LOAD/SAVE operations.
 */

import { test, expect } from "@playwright/test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createClient, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Ecosystem — ProxySQL", () => {
  let client: Client;

  test.beforeAll(async () => {
    client = await createClient();
  });

  test.afterAll(async () => {
    await client.close();
  });

  test("proxysql_runtime_status returns { success }", async () => {
    const payload = await callToolAndParse(client, "proxysql_runtime_status", {});
    expectSuccess(payload);
  });

  test("proxysql_memory_stats returns { success, memoryStats }", async () => {
    const payload = await callToolAndParse(client, "proxysql_memory_stats", {});
    expectSuccess(payload);
    expect(Array.isArray((payload as any).data.memoryStats)).toBe(true);
  });

  test("proxysql_users returns { success, users }", async () => {
    const payload = await callToolAndParse(client, "proxysql_users", {});
    expectSuccess(payload);
    expect(Array.isArray((payload as any).data.users)).toBe(true);
  });

  test("proxysql_query_rules returns { success, queryRules }", async () => {
    const payload = await callToolAndParse(client, "proxysql_query_rules", {});
    expectSuccess(payload);
    expect(Array.isArray((payload as any).data.queryRules)).toBe(true);
  });

  test("proxysql_query_digest returns { success }", async () => {
    const payload = await callToolAndParse(client, "proxysql_query_digest", {});
    expectSuccess(payload);
  });

  test("proxysql_process_list returns { success, processes }", async () => {
    const payload = await callToolAndParse(client, "proxysql_process_list", {});
    expectSuccess(payload);
    expect(Array.isArray((payload as any).data.processes)).toBe(true);
  });
});
