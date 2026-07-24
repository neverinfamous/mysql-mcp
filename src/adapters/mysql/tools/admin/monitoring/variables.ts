import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  ShowVariablesSchema,
  ShowVariablesSchemaBase,
  ShowVariablesOutputSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";

export function createShowVariablesTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_show_variables",
    title: "MySQL Show Variables",
    description: "Show server configuration variables.",
    group: "monitoring",
    inputSchema: ShowVariablesSchemaBase,
    outputSchema: ShowVariablesOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { like, global, limit, summary } = ShowVariablesSchema.parse(params);
        const effectiveLimit = limit ?? 10;

        let sql = global ? "SHOW GLOBAL VARIABLES" : "SHOW VARIABLES";

        // SHOW commands don't support parameter binding - build SQL directly
        if (typeof like === "string") {
          // Escape the like pattern for safety
          const escapedLike = like.replace(/\\/g, "\\\\").replace(/'/g, "''");
          sql += ` LIKE '${escapedLike}'`;
        }

        const result = await adapter.executeQuery(sql);

        // Convert to object
        // Handle both uppercase and Pascal case column names
        const variables: Record<string, string> = {};
        for (const row of result.rows ?? []) {
          const rawName = row["Variable_name"] ?? row["VARIABLE_NAME"] ?? row["variable_name"];
          const name = typeof rawName === "string" ? rawName : "";
          const rawValue = row["Value"] ?? row["VALUE"] ?? row["value"];
          const value = typeof rawValue === "string" ? rawValue : "";
          if (name) {
            variables[name] = value;
          }
        }

        const totalAvailable = Object.keys(variables).length;
        
        let data: Record<string, unknown> = {};

        if (summary) {
          const summaryKeys = [
            "max_connections", "innodb_buffer_pool_size", "innodb_log_file_size", 
            "version", "port", "basedir", "datadir", "tmpdir",
            "character_set_server", "collation_server"
          ];
          const summaryObj: Record<string, string> = {};
          for (const k of summaryKeys) {
            if (variables[k] !== undefined) summaryObj[k] = variables[k];
          }
          data = {
            variables: {},
            rowCount: Object.keys(summaryObj).length,
            totalAvailable,
            summary: summaryObj
          };
        } else {
          const entries = Object.entries(variables);
          const limited = entries.length > effectiveLimit;
          const truncated = limited
            ? Object.fromEntries(entries.slice(0, effectiveLimit))
            : variables;

          data = {
            variables: truncated,
            rowCount: Object.keys(truncated).length,
            totalAvailable,
            ...(limited && { limited: true }),
          };
        }
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify({ success: true, data }), "utf8") / 4,
        );
        return { success: true, data, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
