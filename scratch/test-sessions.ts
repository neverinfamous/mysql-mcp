import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("Starting server...");
  const server = spawn("node", [
    "dist/cli.js", 
    "--transport", "http", 
    "--port", "3333", 
    "--mysql", process.env.MYSQL_TEST_URL ?? "mysql://root:root@localhost:3307/testdb"
  ], {
    env: {
      ...process.env,
      MYSQL_MCP_TOOL_FILTER: "+all",
      ALLOWED_IO_ROOTS: `C:/temp,C:/tmp,/tmp,${tmpdir()}`,
      MCP_RATE_LIMIT_MAX: "10000"
    }
  });

  server.stdout.on("data", (data) => console.log(`[Server] ${data}`));
  server.stderr.on("data", (data) => console.error(`[Server] ${data}`));

  let serverStarted = false;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch("http://localhost:3333/health");
      if (res.ok) {
        serverStarted = true;
        break;
      }
    } catch (err) {
      // wait
    }
    await delay(1000);
  }

  if (!serverStarted) {
    console.error("Server failed to start");
    server.kill();
    process.exit(1);
  }

  console.log("Server started. Running tests...");
  let failures: string[] = [];

  let client: Client | null = null;
  let transport: StreamableHTTPClientTransport | null = null;

  try {
    // Step 1: Baseline Health Check
    let res = await fetch("http://localhost:3333/health");
    let health = await res.json() as any;
    if (health.status !== "healthy") failures.push(`Step 1: Expected status healthy, got ${health.status}`);
    if (health.activeSessions !== undefined && health.activeSessions !== 0) failures.push(`Step 1: Expected activeSessions 0, got ${health.activeSessions}`);
    console.log("Step 1 done. Active sessions:", health.activeSessions);

    // Step 2: Establish a Session
    transport = new StreamableHTTPClientTransport(new URL("http://localhost:3333/mcp"));
    client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    console.log("Step 2 done. Session established.");

    // Step 3: Validate Active Sessions Metric
    res = await fetch("http://localhost:3333/health");
    health = await res.json() as any;
    if (health.activeSessions !== 1) failures.push(`Step 3: Expected activeSessions 1, got ${health.activeSessions}`);
    console.log("Step 3 done. Active sessions:", health.activeSessions);

    // Step 4: Validate Ongoing Communication
    const response = await client.callTool({
      name: "mysql_read_query",
      arguments: { query: "SELECT 1 as val" }
    });
    if (response.isError) {
      failures.push(`Step 4: Tool execution returned isError: true. Response: ${JSON.stringify(response.content)}`);
    } else {
       console.log("Step 4 tool success.");
    }
    console.log("Step 4 done.");

    // Step 5: Document Timeout Behavior
    console.log("Step 5 done: Timeout parameters (30m idle, 24h TTL) are expected by design.");

    // Step 6: Session Termination
    const sid = transport.sessionId;
    await transport.close();
    if (sid) {
      await fetch("http://localhost:3333/mcp", {
        method: "DELETE",
        headers: { "mcp-session-id": sid }
      });
    }
    await delay(1000);
    // Alternatively send a raw DELETE
    // The transport.close() sends an abort, or we can fetch DELETE to the mcp-session-id endpoint.
    // wait, StreamableHTTPServerTransport in the server receives DELETE /mcp?
    // Let's send a DELETE just to be safe if close didn't do it.
    // We don't have the sessionId exposed on client, but the server handles cleanup on close.
    console.log("Step 6 done.");

    // Step 7: Final Validation
    res = await fetch("http://localhost:3333/health");
    health = await res.json() as any;
    if (health.activeSessions !== 0 && health.activeSessions !== undefined) failures.push(`Step 7: Expected activeSessions 0, got ${health.activeSessions}`);
    console.log("Step 7 done. Active sessions:", health.activeSessions);

  } catch (err: any) {
    failures.push(`Exception: ${err.message}`);
  } finally {
    if (client && transport) {
      try {
        await client.close();
      } catch (e) {}
    }
    server.kill();
  }

  console.log("Failures:", failures);
  process.exit(failures.length > 0 ? 1 : 0);
}

runTests();
