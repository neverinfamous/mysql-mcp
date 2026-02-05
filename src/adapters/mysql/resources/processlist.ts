/**
 * MySQL Resource - Processlist
 */
import type { MySQLAdapter } from "../MySQLAdapter.js";
import type {
  ResourceDefinition,
  RequestContext,
} from "../../../types/index.js";

export function createProcesslistResource(
  adapter: MySQLAdapter,
): ResourceDefinition {
  return {
    uri: "mysql://processlist",
    name: "Active Processes",
    title: "MySQL Active Processes",
    description: "Currently running queries and connections",
    mimeType: "application/json",
    annotations: {
      audience: ["user", "assistant"],
      priority: 0.8,
    },
    handler: async (_uri: string, _context: RequestContext) => {
      const result = await adapter.executeQuery("SHOW FULL PROCESSLIST");
      return { processes: result.rows };
    },
  };
}
