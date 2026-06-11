import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { ReplicationStatusOutputSchema } from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { z } from "zod";

export function createReplicationStatusTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  const schema = z.object({
    summary: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Return key replication metrics only instead of full 50+ field output (recommended)",
      ),
  });

  /** Extract key metrics from raw SHOW REPLICA STATUS row */
  function extractReplicationSummary(
    row: Record<string, unknown>,
  ): Record<string, unknown> {
    // Field names differ between MySQL versions (Slave_ vs Replica_)
    return {
      ioRunning:
        row["Replica_IO_Running"] ??
        row["Slave_IO_Running"] ??
        row["replica_io_running"],
      sqlRunning:
        row["Replica_SQL_Running"] ??
        row["Slave_SQL_Running"] ??
        row["replica_sql_running"],
      secondsBehind:
        row["Seconds_Behind_Master"] ??
        row["Seconds_Behind_Source"] ??
        row["seconds_behind_master"],
      lastError:
        row["Last_Error"] ?? row["Last_SQL_Error"] ?? row["last_error"],
      lastErrno:
        row["Last_Errno"] ?? row["Last_SQL_Errno"] ?? row["last_errno"],
      sourceHost:
        row["Master_Host"] ?? row["Source_Host"] ?? row["master_host"],
      sourcePort:
        row["Master_Port"] ?? row["Source_Port"] ?? row["master_port"],
      executedGtidSet: row["Executed_Gtid_Set"] ?? row["executed_gtid_set"],
      retrievedGtidSet: row["Retrieved_Gtid_Set"] ?? row["retrieved_gtid_set"],
      channelName: row["Channel_Name"] ?? row["channel_name"],
    };
  }

  return {
    name: "mysql_replication_status",
    title: "MySQL Replication Status",
    description:
      "Show replication slave/replica status. Use summary=true for key metrics only.",
    group: "monitoring",
    inputSchema: schema,
    outputSchema: ReplicationStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { summary } = schema.parse(params);

        // Try both old and new syntax
        try {
          const result = await adapter.executeQuery("SHOW REPLICA STATUS");
          if (!result.rows || result.rows.length === 0) {
            const response = {
              success: true,
              data: {
                configured: false,
                message: "Replication is not configured on this server",
              },
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }
          const first = result.rows[0];
          if (!first) {
            const response = {
              success: true,
              data: {
                configured: false,
                message: "Replication is not configured on this server",
              },
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }
          const response = {
            success: true,
            data: {
              configured: true,
              status: summary ? extractReplicationSummary(first) : first,
              ...(summary ? { summary: true } : {}),
            },
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        } catch {
          try {
            const result = await adapter.executeQuery("SHOW SLAVE STATUS");
            if (!result.rows || result.rows.length === 0) {
              const response = {
                success: true,
                data: {
                  configured: false,
                  message: "Replication is not configured on this server",
                },
              };
              const tokenEstimate = Math.ceil(
                Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
              );
              return { ...response, metrics: { tokenEstimate } };
            }
            const first = result.rows[0];
            if (!first) {
              const response = {
                success: true,
                data: {
                  configured: false,
                  message: "Replication is not configured on this server",
                },
              };
              const tokenEstimate = Math.ceil(
                Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
              );
              return { ...response, metrics: { tokenEstimate } };
            }
            const response = {
              success: true,
              data: {
                configured: true,
                status: summary ? extractReplicationSummary(first) : first,
                ...(summary ? { summary: true } : {}),
              },
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          } catch {
            const response = {
              success: true,
              data: {
                configured: false,
                message: "Replication is not configured on this server",
              },
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }
        }
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
