import { createServer, MySQLAdapter } from '../dist/index.js';
import http from 'http';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function fetchHttp(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function main() {
  const failures = [];
  const server = createServer({
    transport: 'http',
    port: 8085,
    toolFilter: 'base-core',
    databases: [],
    allowedIoRoots: ['c:/tmp']
  });
  
  const adapter = new MySQLAdapter();
  server.registerAdapter(adapter, 'mysql:default');

  await server.start();
  
  try {
    console.log("Step 1: Baseline health check");
    let res = await fetchHttp('http://localhost:8085/health');
    let health = JSON.parse(res.data);
    console.log(health);
    if (health.status !== 'healthy') failures.push("Health status not healthy");
    if (health.activeSessions !== 0 && health.activeSessions !== undefined) failures.push("activeSessions not 0 or absent");

    console.log("Step 2: Establish session");
    const transport = new SSEClientTransport(new URL("http://localhost:8085/sse"));
    const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    
    console.log("Step 3: Validate Active Sessions Metric");
    res = await fetchHttp('http://localhost:8085/health');
    health = JSON.parse(res.data);
    console.log(health);
    if (health.activeSessions !== 1) failures.push(`activeSessions not 1, was ${health.activeSessions}`);

    console.log("Step 4: Validate Ongoing Communication");
    try {
      await client.callTool({ name: "mysql_core_read_query", arguments: { sql: "SELECT 1" } });
      console.log("Tool execution succeeded");
    } catch(e) {
      console.log("Tool execution error (expected):", e.message);
    }
    
    console.log("Step 6: Session Termination");
    await client.close();
    await new Promise(r => setTimeout(r, 500));
    
    console.log("Step 7: Final Validation");
    res = await fetchHttp('http://localhost:8085/health');
    health = JSON.parse(res.data);
    console.log(health);
    if (health.activeSessions !== 0 && health.activeSessions !== undefined) failures.push(`activeSessions not 0 after close, was ${health.activeSessions}`);

  } catch(e) {
    console.error(e);
    failures.push(e.message);
  } finally {
    await server.stop();
  }
  
  console.log("\n--- TEST RESULTS ---");
  console.log("Failures:", failures);
}

main().catch(console.error);
