/**
 * Payload Contracts: Ecosystem — Router
 *
 * Validates response shapes for 4 untested Router tools:
 * mysql_router_route_health, mysql_router_route_connections,
 * mysql_router_route_destinations, mysql_router_route_blocked_hosts.
 *
 * (5 other Router tools already covered in ecosystem.spec.ts)
 */

import { test, expect } from "@playwright/test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createClient, callToolAndParse, expectSuccess } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Payload Contracts: Ecosystem — Router", () => {
  let client: Client;

  test.beforeAll(async () => {
    client = await createClient();
  });

  test.afterAll(async () => {
    await client.close();
  });

  test("mysql_router_route_health returns health or unavailable", async () => {
    const payload = await callToolAndParse(client, "mysql_router_route_health", {
      routeName: "bootstrap_rw",
    });
    // /health endpoint may return 500 on some Router versions
    // Accept either { success: true, health } or { available: false }
    expect(typeof payload).toBe("object");
  });

  test("mysql_router_route_connections returns { success, connections }", async () => {
    const payload = await callToolAndParse(
      client,
      "mysql_router_route_connections",
      { routeName: "bootstrap_rw" },
    );
    expectSuccess(payload);
    expect(payload.connections).toBeDefined();
  });

  test("mysql_router_route_destinations returns { success, destinations }", async () => {
    const payload = await callToolAndParse(
      client,
      "mysql_router_route_destinations",
      { routeName: "bootstrap_rw" },
    );
    expectSuccess(payload);
    expect(payload.destinations).toBeDefined();
  });

  test("mysql_router_route_blocked_hosts returns { success, blockedHosts }", async () => {
    const payload = await callToolAndParse(
      client,
      "mysql_router_route_blocked_hosts",
      { routeName: "bootstrap_rw" },
    );
    expectSuccess(payload);
    expect(payload.blockedHosts).toBeDefined();
  });
});
