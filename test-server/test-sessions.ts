import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function runTest() {
  console.log("Starting server...");
  const server = spawn('node', ['dist/cli.js', '--transport', 'http', '--port', '12345'], {
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, MYSQL_USER: 'root', MYSQL_PASSWORD: 'root', MYSQL_HOST: '127.0.0.1', MYSQL_DATABASE: 'mysql', ALLOWED_IO_ROOTS: 'C:\\' }
  });

  server.stdout.on('data', (d) => console.log(`SERVER: ${d.toString().trim()}`));
  server.stderr.on('data', (d) => console.error(`SERVER ERR: ${d.toString().trim()}`));

  let serverStarted = false;
  for (let i = 0; i < 20; i++) {
    try {
      await fetch("http://localhost:12345/health");
      serverStarted = true;
      break;
    } catch {
      await delay(500);
    }
  }

  if (!serverStarted) {
    console.error("Server failed to start within 10 seconds");
    server.kill();
    process.exit(1);
  }
  
  const failures: string[] = [];

  try {
    console.log("Step 1: Baseline Health Check");
    let res = await fetch("http://localhost:12345/health");
    let body = await res.json() as any;
    console.log("Health 1:", body);
    if (body.status !== 'healthy') failures.push("Initial health status not healthy");
    if (body.activeSessions !== 0 && body.activeSessions !== undefined) failures.push("Initial activeSessions is not 0 or undefined");

    console.log("Step 2: Establish a Session");
    res = await fetch("http://localhost:12345/mcp", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }
      })
    });
    
    // We expect the mcp-session-id header, but some MCP frameworks may not return headers if doing SSE.
    // Wait, the prompt says POST /mcp (Streamable HTTP) returns mcp-session-id header.
    const sessionId = res.headers.get("mcp-session-id");
    console.log("All headers:");
    res.headers.forEach((v, k) => console.log(k + ': ' + v));
    const initBody = await res.text();
    console.log("Initialize Response Body:", initBody);
    console.log("Session ID assigned:", sessionId);
    if (!sessionId) {
      failures.push("Did not receive mcp-session-id header upon POST /mcp");
    }

    console.log("Step 3: Validate Active Sessions Metric");
    res = await fetch("http://localhost:12345/health");
    body = await res.json() as any;
    console.log("Health 2:", body);
    if (body.activeSessions !== 1) failures.push(`Expected activeSessions: 1, got ${body.activeSessions}`);

    console.log("Step 4: Execute a Tool");
    // We'll call notifications/initialized first, then tool call
    await fetch("http://localhost:12345/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "mcp-session-id": sessionId || "" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized"
      })
    });

    res = await fetch("http://localhost:12345/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "mcp-session-id": sessionId || "" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "mysql_execute_code", arguments: { code: "return { success: true, result: 'hello' }" } }
      })
    });
    const toolResult = await res.text();
    console.log("Tool Result:", toolResult);

    console.log("Step 6: Session Termination");
    res = await fetch("http://localhost:12345/mcp", {
      method: "DELETE",
      headers: { "mcp-session-id": sessionId || "" }
    });
    console.log("DELETE /mcp status:", res.status);
    if (!res.ok) failures.push(`DELETE /mcp failed with status ${res.status}`);

    // Wait a bit for async cleanup
    await delay(1000);

    console.log("Step 7: Final Validation");
    res = await fetch("http://localhost:12345/health");
    body = await res.json() as any;
    console.log("Health 3:", body);
    if (body.activeSessions !== 0 && body.activeSessions !== undefined) failures.push(`Expected activeSessions to be 0 or undefined, got ${body.activeSessions}`);

  } catch (e: any) {
    console.error("Test Exception:", e.message);
    failures.push("Exception during test: " + e.message);
  } finally {
    server.kill();
  }

  if (failures.length > 0) {
    console.error("Test Failures:", failures);
    process.exit(1);
  } else {
    console.log("All tests passed cleanly.");
    process.exit(0);
  }
}

runTest();
