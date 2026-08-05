/**
 * Ecosystem — ProxySQL Metrics Generation & Verification
 *
 * This test intentionally connects to ProxySQL's data port (6033)
 * to generate traffic that tests caching rules, slow queries, and
 * active connection tracking, verifying that the metrics register
 * internally in ProxySQL's stats tables.
 */

import { test, expect } from "@playwright/test";
import type { Client } from "@modelcontextprotocol/client";
import { createClient, callToolAndParse, expectSuccess, startServer, stopServer, TIMEOUTS } from "./helpers.js";
import { setTimeout as delay } from "node:timers/promises";
import * as mysql from "mysql2/promise";

test.describe.configure({ mode: "serial" });

test.describe("ProxySQL Metrics Generation & Verification", () => {
  let client: Client;
  const PORT = 3105 + Number(process.env.TEST_WORKER_INDEX || 0); // Use a dedicated port to avoid conflicts

  test.beforeAll(async () => {
    // Start a dedicated server pointing to ProxySQL Data Port
    await startServer(PORT, [
      "--mysql",
      "mysql://cluster_admin:cluster_admin@192.168.55.39:6033/testdb",
      "--pool-size",
      "5"
    ], "proxysql-test", {
      PROXYSQL_HOST: "192.168.55.39",
      PROXYSQL_PORT: "6032",
      PROXYSQL_USER: "radmin",
      PROXYSQL_PASSWORD: "radmin",
      TOOL_FILTER: "all"
    });
    client = await createClient(`http://127.0.0.1:${PORT}`);
  });

  test.afterAll(async () => {
    await client.close();
    stopServer(PORT);
  });

  test("generates and verifies query cache metrics", async () => {
    // Fire the identical SELECT query multiple times to trigger the ProxySQL caching rule
    // We must use a raw mysql2 connection with .query() (COM_QUERY) because ProxySQL 
    // does not cache prepared statements (COM_STMT_EXECUTE) by default.
    // mysql_read_query always uses prepared statements.
    const conn = await mysql.createConnection({
      host: '192.168.55.39',
      port: 6033,
      user: 'cluster_admin',
      password: 'cluster_admin',
      database: 'testdb'
    });

    const query = "SELECT COUNT(*) FROM test_users;";
    for (let i = 0; i < 5; i++) {
      await conn.query(query);
      await delay(100);
    }
    await conn.end();

    // ProxySQL updates stats periodically, give it a tiny buffer
    await delay(500);

    // Verify cache memory usage > 0
    const statusPayload = await callToolAndParse(client, "proxysql_status", { summary: true });
    expectSuccess(statusPayload);
    
    const statusStats = statusPayload.data!.stats as Array<Record<string, any>>;
    const cacheMemory = statusStats.find(row => row.Variable_Name === 'Query_Cache_Memory_bytes');
    expect(cacheMemory).toBeDefined();
    
    // The value might be a string depending on how ProxySQL returns it, so convert if needed
    const cacheBytes = Number(cacheMemory?.Variable_Value || 0);
    expect(cacheBytes).toBeGreaterThan(0);

    // Verify cache hits > 0
    const cacheEntries = statusStats.find(row => row.Variable_Name === 'Query_Cache_Entries');
    expect(cacheEntries).toBeDefined();
    const cacheEntriesCount = Number(cacheEntries?.Variable_Value || 0);
    expect(cacheEntriesCount).toBeGreaterThan(0);

    // Verify cache read throughput (GET and GET_OK)
    const cacheGet = statusStats.find(row => row.Variable_Name === 'Query_Cache_count_GET');
    expect(cacheGet).toBeDefined();
    expect(Number(cacheGet?.Variable_Value || 0)).toBeGreaterThan(0);

    const cacheGetOk = statusStats.find(row => row.Variable_Name === 'Query_Cache_count_GET_OK');
    expect(cacheGetOk).toBeDefined();
    expect(Number(cacheGetOk?.Variable_Value || 0)).toBeGreaterThan(0);

    // Verify cache write throughput (SET, bytes IN/OUT)
    const cacheSet = statusStats.find(row => row.Variable_Name === 'Query_Cache_count_SET');
    expect(cacheSet).toBeDefined();
    expect(Number(cacheSet?.Variable_Value || 0)).toBeGreaterThan(0);

    const cacheBytesIn = statusStats.find(row => row.Variable_Name === 'Query_Cache_bytes_IN');
    expect(cacheBytesIn).toBeDefined();
    expect(Number(cacheBytesIn?.Variable_Value || 0)).toBeGreaterThan(0);

    const cacheBytesOut = statusStats.find(row => row.Variable_Name === 'Query_Cache_bytes_OUT');
    expect(cacheBytesOut).toBeDefined();
    expect(Number(cacheBytesOut?.Variable_Value || 0)).toBeGreaterThan(0);
  });

  test("generates and verifies slow query metrics (>5s)", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // Execute a query > 5s
    const slowQuery = "SELECT SLEEP(6) AS sleep_time;";
    const res = await callToolAndParse(client, "mysql_read_query", { query: slowQuery });
    expectSuccess(res);

    // ProxySQL updates stats periodically, poll until it appears
    let sleepQuery: Record<string, any> | undefined;
    for (let i = 0; i < 10; i++) {
      await delay(1000);
      const digestPayload = await callToolAndParse(client, "proxysql_query_digest", { limit: 100 });
      if (!digestPayload.success) continue;
      
      const queries = digestPayload.data!.queryDigests as Array<Record<string, any>>;
      sleepQuery = queries.find(row => String(row.digest_text).toUpperCase().includes('SLEEP_TIME'));
      if (sleepQuery) break;
    }
    expect(sleepQuery).toBeDefined();
    
    // Check that it registered execution time
    const maxTime = Number(sleepQuery?.sum_time || 0);
    expect(maxTime).toBeGreaterThan(4000000); // sum_time is typically in microseconds (allow some tolerance for < 5s)
  });
});
