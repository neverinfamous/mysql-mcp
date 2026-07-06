/**
 * E2E Tests: OAuth 2.1 Scope Enforcement
 *
 * Verifies that the adapter-level scope enforcement (database-adapter.ts)
 * correctly blocks tool calls when the JWT lacks the required scope.
 *
 * Architecture note: mysql-mcp enforces scope inside the registerTool()
 * callback via getAuthContext() → getRequiredScope() → requireScope().
 * This means denied calls return MCP-level isError responses (HTTP 200),
 * not HTTP 403. All test cases require a full session handshake.
 *
 * Representative tools per scope level:
 *   read:  mysql_list_tables      (core group → read scope)
 *   write: mysql_transaction_begin (transactions group → write scope)
 *   admin: mysql_kill_query       (admin group → admin scope)
 *
 * Ports: 3107 (MCP server), 3108 (mock JWKS)
 */

import { test, expect } from "@playwright/test";
import { type ChildProcess, spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { Buffer } from "node:buffer";
import * as jose from "jose";
import { tmpdir } from "node:os";

const MCP_PORT = 3157;
const JWKS_PORT = 3158;
const ISSUER = "https://auth.example.com/mysql-scope-test";
const AUDIENCE = "mysql-mcp-server";

test.describe.configure({ mode: "serial" });

test.describe.serial("OAuth 2.1 Scope Enforcement E2E", () => {
  let serverProcess: ChildProcess;
  let jwksServer: Server;

  // JWTs
  let readToken: string;
  let writeToken: string;
  let adminToken: string;
  let expiredToken: string;
  let invalidSignatureToken: string;
  let invalidScopeToken: string;

  test.beforeAll(async () => {
    // 1. Generate RS256 keypair
    const keypair = await jose.generateKeyPair("RS256");
    const publicJwk = await jose.exportJWK(keypair.publicKey);
    publicJwk.kid = "scope-test-kid-1";
    publicJwk.use = "sig";
    publicJwk.alg = "RS256";

    // 2. Start mock JWKS HTTP server (raw node:http)
    await new Promise<void>((resolve) => {
      jwksServer = createServer((req, res) => {
        try {
          console.log("JWKS Server received request");
          if (req.url === "/jwks") {
            const body = JSON.stringify({ keys: [publicJwk] });
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body),
              "Connection": "close"
            });
            res.end(body);
          } else {
            res.writeHead(404, { "Connection": "close" });
            res.end();
          }
        } catch (e) {
          console.error("JWKS Server error:", e);
        }
      });
      jwksServer.listen(JWKS_PORT, "127.0.0.1", () => {
        console.log("JWKS Server listening on 127.0.0.1:" + JWKS_PORT);
        resolve();
      });
    });

    // 3. Generate tokens with varying scopes
    const makeToken = async (scope: string): Promise<string> =>
      await new jose.SignJWT({ scope })
        .setProtectedHeader({ alg: "RS256", kid: "scope-test-kid-1" })
        .setIssuedAt()
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setExpirationTime("1h")
        .sign(keypair.privateKey);

    readToken = await makeToken("mysql:read read");
    writeToken = await makeToken("mysql:read read write");
    adminToken = await makeToken("mysql:read read write admin");
    invalidScopeToken = await makeToken("other:scope");

    // Token that expired 1 hour ago
    expiredToken = await new jose.SignJWT({ scope: "read" })
      .setProtectedHeader({ alg: "RS256", kid: "scope-test-kid-1" })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(keypair.privateKey);

    // Token with invalid signature
    const badKeypair = await jose.generateKeyPair("RS256");
    invalidSignatureToken = await new jose.SignJWT({ scope: "read" })
      .setProtectedHeader({ alg: "RS256", kid: "scope-test-kid-1" })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime("1h")
      .sign(badKeypair.privateKey);

    // 4. Start mysql-mcp with OAuth enabled
    serverProcess = spawn(
      "node",
      [
        "dist/cli.js",
        "--server-host",
        "127.0.0.1",
        "--transport",
        "http",
        "--port",
        String(MCP_PORT),
        "--mysql",
        process.env.MYSQL_TEST_URL ?? "mysql://root:root@localhost:3306/testdb",
        "--stateless",
        "--log-level",
        "debug",
        "--tool-filter",
        "+all",
        "--oauth-enabled",
        "--oauth-issuer",
        ISSUER,
        "--oauth-audience",
        AUDIENCE,
        "--oauth-jwks-uri",
        `http://127.0.0.1:${JWKS_PORT}/jwks`,
      ],
      {
        cwd: process.cwd(),
        stdio: "pipe",
        env: {
          ...process.env,
          MCP_RATE_LIMIT_MAX: "10000",
          NO_PROXY: "*",
          ALLOWED_IO_ROOTS: `C:/temp,C:/tmp,/tmp,${tmpdir()}`,
        },
      },
    );

    serverProcess.stdout?.on("data", (data) => console.log(`[TEST-SERVER]: ${data.toString()}`));
    serverProcess.stderr?.on("data", (data) => console.error(`[TEST-SERVER]: ${data.toString()}`));

    // Wait for server readiness
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${MCP_PORT}/health`);
        if (res.ok) break;
      } catch {
        // Not ready yet
      }
      await delay(500);
    }
  });

  test.afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
    }
    if (jwksServer) {
      await new Promise<void>((resolve) => jwksServer.close(() => resolve()));
    }
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  async function initializeSession(token: string): Promise<string> {
    const base = `http://127.0.0.1:${MCP_PORT}/mcp`;
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    };

    console.log("Fetching /mcp with initialize...");
    const initRes = await fetch(base, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "scope-test-client", version: "1.0" },
        },
      }),
    });
    console.log("Fetch complete. Status:", initRes.status);
    expect(initRes.status).toBe(200);

    // In stateless mode, there is no session ID and no need for the initialized notification.
    return "";
  }

  async function callTool(
    token: string,
    sessionId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    };
    if (sessionId) {
      headers["mcp-session-id"] = sessionId;
    }

    const res = await fetch(`http://127.0.0.1:${MCP_PORT}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Math.floor(Math.random() * 10000),
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
    });

    // Do not assert status here so that tests can assert on 403s
    // expect(res.status).toBe(200);

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      const text = await res.text();
      const lines = text.split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (line?.startsWith("data: ")) {
          return JSON.parse(line.slice(6)) as Record<string, unknown>;
        }
      }
      throw new Error("No data event found in SSE response");
    }

    return (await res.json()) as Record<string, unknown>;
  }

  function extractResult(rpcResponse: Record<string, unknown>): {
    isError: boolean;
    text: string;
  } {
    // Handle OAuth middleware errors directly (e.g. 403 HTTP status parsed as JSON)
    if (rpcResponse.error && typeof rpcResponse.error === "string") {
      return { isError: true, text: String(rpcResponse.error_description || rpcResponse.error) };
    }
    
    // Handle JSON-RPC errors
    if (rpcResponse.error && typeof rpcResponse.error === "object") {
      const errObj = rpcResponse.error as { message?: string };
      return { isError: true, text: errObj.message ?? "Unknown RPC error" };
    }
    const result = rpcResponse.result as
      | {
          content?: Array<{ type: string; text: string }>;
          isError?: boolean;
        }
      | undefined;

    if (!result?.content?.[0]) {
      return { isError: true, text: "No content in response" };
    }

    return {
      isError: result.isError === true,
      text: result.content[0].text,
    };
  }

  // ─── Tests ──────────────────────────────────────────────────────────────────

  test("read token can call read-scoped tools but is blocked from write and admin tools", async () => {
    const session = await initializeSession(readToken);

    // ✅ ALLOWED: mysql_list_tables (core group → read scope)
    const listResult = await callTool(readToken, session, "mysql_list_tables", {});
    const listExtracted = extractResult(listResult);
    expect(listExtracted.isError).toBe(false);

    // ❌ DENIED: mysql_transaction_begin (transactions group → write scope)
    const txResult = await callTool(
      readToken,
      session,
      "mysql_transaction_begin",
      {},
    );
    const txExtracted = extractResult(txResult);
    expect(txExtracted.isError).toBe(true);
    expect(txExtracted.text.toLowerCase()).toContain("insufficient scope");

    // ❌ DENIED: mysql_kill_query (admin group → admin scope)
    const vacuumResult = await callTool(readToken, session, "mysql_kill_query", {
      processId: 999999,
    });
    const vacuumExtracted = extractResult(vacuumResult);
    expect(vacuumExtracted.isError).toBe(true);
    expect(vacuumExtracted.text.toLowerCase()).toContain("insufficient scope");
  });

  test("write token can call read and write tools but is blocked from admin tools", async () => {
    const session = await initializeSession(writeToken);

    // ✅ ALLOWED: mysql_list_tables (core → read, write scope includes read)
    const listResult = await callTool(
      writeToken,
      session,
      "mysql_list_tables",
      {},
    );
    const listExtracted = extractResult(listResult);
    expect(listExtracted.isError).toBe(false);

    // ✅ ALLOWED: mysql_transaction_begin (transactions → write scope)
    const txResult = await callTool(
      writeToken,
      session,
      "mysql_transaction_begin",
      {},
    );
    const txExtracted = extractResult(txResult);
    expect(txExtracted.isError).toBe(false);

    // ❌ DENIED: mysql_kill_query (admin group → admin scope)
    const vacuumResult = await callTool(writeToken, session, "mysql_kill_query", {
      processId: 999999,
    });
    const vacuumExtracted = extractResult(vacuumResult);
    expect(vacuumExtracted.isError).toBe(true);
    expect(vacuumExtracted.text.toLowerCase()).toContain("insufficient scope");
  });

  test("admin token can call admin-scoped tools", async () => {
    const session = await initializeSession(adminToken);

    // ✅ ALLOWED: mysql_kill_query (admin group → admin scope)
    const vacuumResult = await callTool(adminToken, session, "mysql_kill_query", {
      processId: 999999,
    });
    const vacuumExtracted = extractResult(vacuumResult);

    // If it errors, it should be a DB-level error, not a scope error
    if (vacuumExtracted.isError) {
      expect(vacuumExtracted.text.toLowerCase()).not.toContain(
        "insufficient scope",
      );
    }
  });

  test("read token is blocked from core write tools", async () => {
    const session = await initializeSession(readToken);

    // ❌ DENIED: mysql_write_query (core group → write scope override)
    const writeResult = await callTool(readToken, session, "mysql_write_query", {
      sql: "INSERT INTO test (id) VALUES (1)",
    });
    const writeExtracted = extractResult(writeResult);
    expect(writeExtracted.isError).toBe(true);
    expect(writeExtracted.text.toLowerCase()).toContain("insufficient scope");

    // ❌ DENIED: mysql_create_table (core group → write scope override)
    const createResult = await callTool(readToken, session, "mysql_create_table", {
      table: "test_table",
      columns: [{ name: "id", type: "INT" }],
    });
    const createExtracted = extractResult(createResult);
    expect(createExtracted.isError).toBe(true);
    expect(createExtracted.text.toLowerCase()).toContain("insufficient scope");
  });

  test("write token is blocked from core destructive tools but allowed core write tools", async () => {
    const session = await initializeSession(writeToken);

    // ✅ ALLOWED: mysql_write_query (core group → write scope override)
    const writeResult = await callTool(writeToken, session, "mysql_write_query", {
      sql: "INSERT INTO test (id) VALUES (1)",
    });
    const writeExtracted = extractResult(writeResult);
    if (writeExtracted.isError) {
      expect(writeExtracted.text.toLowerCase()).not.toContain(
        "insufficient scope",
      );
    }

    // ❌ DENIED: mysql_drop_table (core group → admin scope override)
    const dropResult = await callTool(writeToken, session, "mysql_drop_table", {
      table: "test_table",
    });
    const dropExtracted = extractResult(dropResult);
    expect(dropExtracted.isError).toBe(true);
    expect(dropExtracted.text.toLowerCase()).toContain("insufficient scope");
  });

  test("expired or invalid tokens are rejected at connection time", async () => {
    const base = `http://127.0.0.1:${MCP_PORT}/mcp`;

    const getInitRes = async (token: string) =>
      fetch(base, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "scope-test-client", version: "1.0" },
          },
        }),
      });

    const resExpired = await getInitRes(expiredToken);
    expect(resExpired.status).toBe(401);

    const resInvalid = await getInitRes(invalidSignatureToken);
    expect(resInvalid.status).toBe(401);
  });
});
