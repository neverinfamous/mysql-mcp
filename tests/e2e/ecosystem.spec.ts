import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

test.describe.configure({ mode: "serial" });

test.describe("Ecosystem Tools (via MCP SDK Client)", () => {
  let client: Client;

  test.beforeAll(async () => {
    const transport = new SSEClientTransport(
      new URL("http://localhost:3000/sse"),
    );
    client = new Client(
      { name: "playwright-ecosystem-client", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
  });

  test.afterAll(async () => {
    await client.close();
  });

  // ─── Router Tools (9 available, testing 5) ───

  test("should get router status (router: mysql_router_status)", async () => {
    const response = await client.callTool({
      name: "mysql_router_status",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray((response as any).content)).toBe(true);
    expect((response as any).content.length).toBeGreaterThan(0);

    const parsed = JSON.parse(((response as any).content[0] as any).text);
    expect(parsed).toHaveProperty("success", true);
    // Router status nests data under .data
    expect(parsed).toHaveProperty("data");
    expect(parsed.data).toHaveProperty("hostname");
    expect(parsed.data).toHaveProperty("version");
  });

  test("should list router routes (router: mysql_router_routes)", async () => {
    const response = await client.callTool({
      name: "mysql_router_routes",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray((response as any).content)).toBe(true);
    expect((response as any).content.length).toBeGreaterThan(0);

    const parsed = JSON.parse(((response as any).content[0] as any).text);
    expect(parsed).toHaveProperty("success", true);
    expect(parsed).toHaveProperty("data");
  });

  test("should get route status (router: mysql_router_route_status)", async () => {
    const response = await client.callTool({
      name: "mysql_router_route_status",
      arguments: { routeName: "bootstrap_rw" },
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray((response as any).content)).toBe(true);
    expect((response as any).content.length).toBeGreaterThan(0);

    const parsed = JSON.parse(((response as any).content[0] as any).text);
    expect(parsed).toHaveProperty("success", true);
  });

  test("should get metadata status (router: mysql_router_metadata_status)", async () => {
    const response = await client.callTool({
      name: "mysql_router_metadata_status",
      arguments: { metadataName: "bootstrap" },
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray((response as any).content)).toBe(true);
    expect((response as any).content.length).toBeGreaterThan(0);

    const parsed = JSON.parse(((response as any).content[0] as any).text);
    expect(parsed).toHaveProperty("success", true);
  });

  test("should get pool status (router: mysql_router_pool_status)", async () => {
    const response = await client.callTool({
      name: "mysql_router_pool_status",
      arguments: { poolName: "main" },
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray((response as any).content)).toBe(true);
    expect((response as any).content.length).toBeGreaterThan(0);

    const parsed = JSON.parse(((response as any).content[0] as any).text);
    expect(parsed).toHaveProperty("success", true);
  });

  // ─── ProxySQL Tools (12 available, testing 5) ───

  test("should get proxysql status (proxysql: proxysql_status)", async () => {
    const response = await client.callTool({
      name: "proxysql_status",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray((response as any).content)).toBe(true);
    expect((response as any).content.length).toBeGreaterThan(0);

    const parsed = JSON.parse(((response as any).content[0] as any).text);
    expect(parsed).toHaveProperty("success", true);
  });

  test("should list proxysql servers (proxysql: proxysql_servers)", async () => {
    const response = await client.callTool({
      name: "proxysql_servers",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray((response as any).content)).toBe(true);
    expect((response as any).content.length).toBeGreaterThan(0);

    const parsed = JSON.parse(((response as any).content[0] as any).text);
    expect(parsed).toHaveProperty("success", true);
  });

  test("should list proxysql hostgroups (proxysql: proxysql_hostgroups)", async () => {
    const response = await client.callTool({
      name: "proxysql_hostgroups",
      arguments: {},
    });

    // ProxySQL hostgroups may return empty/error if no hostgroups configured
    expect(Array.isArray((response as any).content)).toBe(true);
    expect((response as any).content.length).toBeGreaterThan(0);
    expect((response as any).content[0].type).toBe("text");
  });

  test("should get proxysql connection pool (proxysql: proxysql_connection_pool)", async () => {
    const response = await client.callTool({
      name: "proxysql_connection_pool",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray((response as any).content)).toBe(true);
    expect((response as any).content.length).toBeGreaterThan(0);

    const parsed = JSON.parse(((response as any).content[0] as any).text);
    expect(parsed).toHaveProperty("success", true);
  });

  test("should get proxysql global variables (proxysql: proxysql_global_variables)", async () => {
    const response = await client.callTool({
      name: "proxysql_global_variables",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray((response as any).content)).toBe(true);
    expect((response as any).content.length).toBeGreaterThan(0);

    const parsed = JSON.parse(((response as any).content[0] as any).text);
    expect(parsed).toHaveProperty("success", true);
  });

  // ─── Cluster Tools (10 available, testing 5) ───

  test("should get GR status (cluster: mysql_gr_status)", async () => {
    const response = await client.callTool({
      name: "mysql_gr_status",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray((response as any).content)).toBe(true);
    expect((response as any).content.length).toBeGreaterThan(0);

    const parsed = JSON.parse(((response as any).content[0] as any).text);
    expect(parsed).toHaveProperty("success", true);
    expect(parsed.data).toHaveProperty("enabled");
    expect(parsed.data).toHaveProperty("groupName");
  });

  test("should list GR members (cluster: mysql_gr_members)", async () => {
    const response = await client.callTool({
      name: "mysql_gr_members",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray((response as any).content)).toBe(true);
    expect((response as any).content.length).toBeGreaterThan(0);

    const parsed = JSON.parse(((response as any).content[0] as any).text);
    expect(parsed).toHaveProperty("success", true);
    expect(parsed.data).toHaveProperty("members");
    expect(parsed.data).toHaveProperty("count");
  });

  test("should get GR primary (cluster: mysql_gr_primary)", async () => {
    const response = await client.callTool({
      name: "mysql_gr_primary",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray((response as any).content)).toBe(true);
    expect((response as any).content.length).toBeGreaterThan(0);

    const parsed = JSON.parse(((response as any).content[0] as any).text);
    expect(parsed).toHaveProperty("success", true);
    expect(parsed.data).toHaveProperty("hasPrimary");
  });

  test("should get cluster status (cluster: mysql_cluster_status)", async () => {
    const response = await client.callTool({
      name: "mysql_cluster_status",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray((response as any).content)).toBe(true);
    expect((response as any).content.length).toBeGreaterThan(0);

    const parsed = JSON.parse(((response as any).content[0] as any).text);
    expect(parsed).toHaveProperty("success", true);
    expect(parsed.data).toHaveProperty("isInnoDBCluster");
  });

  test("should list cluster instances (cluster: mysql_cluster_instances)", async () => {
    const response = await client.callTool({
      name: "mysql_cluster_instances",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray((response as any).content)).toBe(true);
    expect((response as any).content.length).toBeGreaterThan(0);

    const parsed = JSON.parse(((response as any).content[0] as any).text);
    expect(parsed).toHaveProperty("success", true);
    expect(parsed.data).toHaveProperty("instances");
    expect(parsed.data).toHaveProperty("count");
  });
});
