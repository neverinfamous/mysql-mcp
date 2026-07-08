/**
 * Payload Contracts: Ecosystem — Cluster
 *
 * Validates response shapes for 4 untested Cluster tools:
 * mysql_cluster_topology, mysql_cluster_router_status,
 * mysql_gr_transactions, mysql_gr_flow_control.
 *
 * (5 other Cluster tools already covered in ecosystem.spec.ts)
 * mysql_cluster_switchover excluded — destructive operation.
 */

import { test, expect } from "@playwright/test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createClient, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Ecosystem — Cluster", () => {
  let client: Client;

  test.beforeAll(async () => {
    client = await createClient();
  });

  test.afterAll(async () => {
    await client.close();
  });

  test("mysql_cluster_topology returns { success, topology }", async () => {
    const payload = await callToolAndParse(
      client,
      "mysql_cluster_topology",
      {},
    );
    expectSuccess(payload);
    expect(payload.data.topology).toBeDefined();
  });

  test("mysql_cluster_router_status returns { success }", async () => {
    const payload = await callToolAndParse(
      client,
      "mysql_cluster_router_status",
      {},
    );
    expectSuccess(payload);
  });

  test("mysql_gr_transactions returns { success }", async () => {
    const payload = await callToolAndParse(client, "mysql_gr_transactions", {});
    expectSuccess(payload);
  });

  test("mysql_gr_flow_control returns { success }", async () => {
    const payload = await callToolAndParse(client, "mysql_gr_flow_control", {});
    expectSuccess(payload);
  });
});
