import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/transport/stdio.js";

async function run() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/cli.js", "--transport", "stdio", "--audit-log", "logs/mcp-audit.jsonl"],
    env: { ...process.env, ALLOWED_IO_ROOTS: "C:/" }
  });

  const client = new Client({ name: "test", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  
  // Call a tool
  try {
    console.log("Calling tool...");
    await client.callTool({ name: "mysql_sys_host_summary", arguments: {} });
  } catch (err) {
    console.log("Tool error:", err.message);
  }
  
  console.log("Reading metrics...");
  const result = await client.readResource({ uri: "mysql://metrics" });
  console.log(result.contents[0].text);
  
  process.exit(0);
}

run().catch(console.error);
