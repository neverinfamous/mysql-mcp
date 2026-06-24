import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

async function delay(ms) {
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
  let failures = [];

  try {
    // Step 1: Baseline Health Check
    let res = await fetch("http://localhost:3333/health");
    let health = await res.json();
    if (health.status !== "healthy") failures.push(`Step 1: Expected status healthy, got ${health.status}`);
    if (health.activeSessions !== undefined && health.activeSessions !== 0) failures.push(`Step 1: Expected activeSessions 0, got ${health.activeSessions}`);
    console.log("Step 1 done. Active sessions:", health.activeSessions);

    // Step 2: Establish a Session
    const initPayload = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: { roots: { listChanged: true } },
        clientInfo: { name: "test-client", version: "1.0.0" }
      }
    };
    
    res = await fetch("http://localhost:3333/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initPayload)
    });
    const sessionId = res.headers.get("mcp-session-id") || res.headers.get("x-mcp-session-id");
    const initResponse = await res.json();
    if (!sessionId) failures.push("Step 2: Missing session ID header");
    if (!initResponse.result || !initResponse.result.capabilities) failures.push("Step 2: Invalid initialize response");
    console.log("Step 2 done. Session ID:", sessionId);

    // Send initialized notification
    await fetch("http://localhost:3333/mcp", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "mcp-session-id": sessionId
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized"
      })
    });

    // Step 3: Validate Active Sessions Metric
    res = await fetch("http://localhost:3333/health");
    health = await res.json();
    if (health.activeSessions !== 1) failures.push(`Step 3: Expected activeSessions 1, got ${health.activeSessions}`);
    console.log("Step 3 done. Active sessions:", health.activeSessions);

    // Step 4: Validate Ongoing Communication
    res = await fetch("http://localhost:3333/mcp", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "mcp-session-id": sessionId
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "mysql_core_read_query",
          arguments: { query: "SELECT 1 as val" }
        }
      })
    });
    const toolResponse = await res.json();
    if (toolResponse.error) {
      failures.push(`Step 4: Tool execution failed: ${JSON.stringify(toolResponse.error)}`);
    } else {
      const isError = toolResponse.result?.isError;
      if (isError) {
         failures.push(`Step 4: Tool execution returned isError: true. Response: ${JSON.stringify(toolResponse.result)}`);
      }
    }
    console.log("Step 4 done.");

    // Step 6: Session Termination
    res = await fetch("http://localhost:3333/mcp", {
      method: "DELETE",
      headers: { 
        "mcp-session-id": sessionId
      }
    });
    if (!res.ok) failures.push(`Step 6: DELETE /mcp failed with status ${res.status}`);
    console.log("Step 6 done.");

    // Step 7: Final Validation
    await delay(1000); // wait for cleanup
    res = await fetch("http://localhost:3333/health");
    health = await res.json();
    if (health.activeSessions !== 0 && health.activeSessions !== undefined) failures.push(`Step 7: Expected activeSessions 0, got ${health.activeSessions}`);
    console.log("Step 7 done. Active sessions:", health.activeSessions);

  } catch (err) {
    failures.push(`Exception: ${err.message}`);
  } finally {
    server.kill();
  }

  console.log("Failures:", failures);
}

runTests();
