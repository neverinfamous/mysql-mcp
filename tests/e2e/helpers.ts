/**
 * Shared E2E test helpers for mysql-mcp payload contract tests.
 *
 * Provides createClient / callToolAndParse / expectSuccess utilities
 * matching the mysql-mcp SSE transport pattern.
 */

import { expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const BASE_URL = "http://localhost:3000";

/**
 * Create a connected MCP client via SSE transport.
 */
export async function createClient(): Promise<Client> {
  const transport = new SSEClientTransport(new URL(`${BASE_URL}/sse`));
  const client = new Client(
    { name: "payload-test-client", version: "1.0.0" },
    { capabilities: {} },
  );
  await client.connect(transport);
  return client;
}

/**
 * Call a tool and return the parsed JSON payload.
 */
export async function callToolAndParse(
  client: Client,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await client.callTool({
    name: toolName,
    arguments: args,
  });

  expect(Array.isArray(response.content)).toBe(true);
  expect(response.content.length).toBeGreaterThan(0);

  const first = response.content[0] as { type: string; text: string };
  expect(first.type).toBe("text");

  return JSON.parse(first.text) as Record<string, unknown>;
}

/**
 * Assert payload.success is truthy, with a descriptive error message on failure.
 */
export function expectSuccess(payload: Record<string, unknown>): void {
  const msg = !payload.success
    ? `Tool error: ${JSON.stringify(payload, null, 2)}`
    : "";
  expect(payload.success, msg).toBe(true);
}
