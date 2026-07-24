import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  ShowProcesslistSchema,
  ShowProcesslistSchemaBase,
  ShowProcesslistOutputSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";

export function createShowProcesslistTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_show_processlist",
    title: "MySQL Show Processlist",
    description: "Show all running processes and queries.",
    group: "monitoring",
    inputSchema: ShowProcesslistSchemaBase,
    outputSchema: ShowProcesslistOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { full, limit, summary } = ShowProcesslistSchema.parse(params);
        const sql = full ? "SHOW FULL PROCESSLIST" : "SHOW PROCESSLIST";
        const result = await adapter.executeQuery(sql);
        const allRows = result.rows ?? [];
        const totalAvailable = allRows.length;
        
        let data: Record<string, unknown> = {};
        
        if (summary) {
          const stateCounts: Record<string, number> = {};
          const commandCounts: Record<string, number> = {};
          for (const row of allRows) {
            const rawState = row["State"] ?? row["STATE"] ?? row["state"] ?? "";
            const rawCommand = row["Command"] ?? row["COMMAND"] ?? row["command"] ?? "Unknown";
            const state = typeof rawState === "string" || typeof rawState === "number" || typeof rawState === "boolean" ? String(rawState) : "";
            const command = typeof rawCommand === "string" || typeof rawCommand === "number" || typeof rawCommand === "boolean" ? String(rawCommand) : "Unknown";
            const stateKey = state.trim() || "None";
            stateCounts[stateKey] = (stateCounts[stateKey] ?? 0) + 1;
            commandCounts[command] = (commandCounts[command] ?? 0) + 1;
          }
          data = {
            processes: [],
            count: allRows.length,
            totalAvailable,
            summary: {
              byState: stateCounts,
              byCommand: commandCounts
            }
          };
        } else {
          const limited = totalAvailable > limit;
          const processes = limited ? allRows.slice(0, limit) : allRows;
          data = {
            processes,
            count: processes.length,
            ...(limited ? { limited: true, totalAvailable } : {}),
          };
        }
        
        const response = {
          success: true,
          data,
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
