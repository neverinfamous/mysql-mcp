import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  ShowStatusSchema,
  ShowStatusSchemaBase,
  ShowStatusOutputSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";

export function createShowStatusTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_show_status",
    title: "MySQL Show Status",
    description: "Show server status variables.",
    group: "monitoring",
    inputSchema: ShowStatusSchemaBase,
    outputSchema: ShowStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { like, global, limit } = ShowStatusSchema.parse(params);
        const effectiveLimit = limit ?? 30;

        let sql = global ? "SHOW GLOBAL STATUS" : "SHOW STATUS";

        // SHOW commands don't support parameter binding - build SQL directly
        if (typeof like === "string" && like.length > 0) {
          // Escape the like pattern for safety
          const escapedLike = like.replace(/'/g, "''");
          sql += ` LIKE '${escapedLike}'`;
        }

        const result = await adapter.executeQuery(sql);

        // Convert to object for easier use
        // Handle both uppercase and Pascal case column names
        const status: Record<string, string> = {};
        for (const row of result.rows ?? []) {
          const rawName = row["Variable_name"] ?? row["VARIABLE_NAME"] ?? row["variable_name"];
          const name = typeof rawName === "string" ? rawName : "";
          const rawValue = row["Value"] ?? row["VALUE"] ?? row["value"];
          const value = typeof rawValue === "string" ? rawValue : "";
          if (name) {
            // Redact RSA public key blobs (multi-line PEM certificates)
            status[name] = value?.includes("-----BEGIN PUBLIC KEY-----")
              ? "[REDACTED]"
              : value;
          }
        }

        const totalAvailable = Object.keys(status).length;
        const entries = Object.entries(status);
        const limited = entries.length > effectiveLimit;
        const truncated = limited
          ? Object.fromEntries(entries.slice(0, effectiveLimit))
          : status;

        const data = {
          status: truncated,
          rowCount: Object.keys(truncated).length,
          totalAvailable,
          ...(limited && { limited: true }),
        };
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
