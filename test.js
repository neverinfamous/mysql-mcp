import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

async function run() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/cli.js", "--transport", "stdio", "--audit-log", "logs/mcp-audit.jsonl", "--audit-reads"],
    env: { ...process.env, ALLOWED_IO_ROOTS: "C:/" }
  });

  const client = new Client({ name: "test", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  
  // Call a tool
  try {
    console.log("Calling tool...");
    await client.callTool({ name: "mysql_read_query", arguments: { query: "SELECT 1" } });
    console.log("Tool called successfully");
  } catch (err) {
    console.log("Tool error:", err.message);
  }
  
  console.log("Reading metrics...");
  const result = await client.readResource({ uri: "mysql://metrics" });
  console.log(result.contents[0].text);
  
  process.exit(0);
}

run().catch(console.error);
