import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import {
  CascadeSimulatorSchemaBase,
  CascadeSimulatorSchema,
  CascadeSimulatorOutputSchema,
} from "../../../schemas/index.js";
import { MySQLMcpError } from "../../../../../types/modules/errors.js";
import { ErrorCategory } from "../../../../../types/modules/error-types.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import type { FkEdge } from "../helpers.js";
import {
  fetchForeignKeys,
  fetchTableNodes,
  qualifiedName,
} from "../helpers.js";

export function createCascadeSimulatorTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_cascade_simulator",
    title: "Cascade Simulator",
    description:
      "Simulate the impact of DELETE, DROP, or TRUNCATE on a table. Returns affected tables, estimated row counts, cascade paths, and severity assessment.",
    group: "introspection",
    inputSchema: CascadeSimulatorSchemaBase,
    outputSchema: CascadeSimulatorOutputSchema,
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = CascadeSimulatorSchema.parse(params);
        let schema = parsed.schema;

        if (!schema) {
          const dbRow = (
            await adapter.executeReadQuery("SELECT DATABASE() as db")
          ).rows?.[0];
          schema = typeof dbRow?.["db"] === "string" ? dbRow["db"] : "mysql";
        }

        const operation = parsed.operation ?? "DELETE";
        const sourceQName = qualifiedName(schema, parsed.table);

        // Cascade simulator must include ALL schemas for accurate cascade path tracing
        const [fks, tables] = await Promise.all([
          fetchForeignKeys(adapter, undefined),
          fetchTableNodes(adapter, undefined),
        ]);

        const tableMap = new Map(
          tables.map((t) => [qualifiedName(t.schema, t.table), t]),
        );

        // Check if source table exists
        if (!tableMap.has(sourceQName)) {
          throw new MySQLMcpError(
            `Table '${sourceQName}' does not exist. Use mysql_list_tables to verify.`,
            "TABLE_NOT_FOUND",
            ErrorCategory.VALIDATION,
            {
              suggestion:
                "Ensure you are specifying the correct table and schema.",
              recoverable: true,
            },
          );
        }

        // Build reverse adjacency: for each table, find what references it
        // (which tables have FKs pointing TO this table)
        const referencedBy = new Map<string, FkEdge[]>();
        for (const fk of fks) {
          const to = qualifiedName(fk.toSchema, fk.toTable);
          const existing = referencedBy.get(to) ?? [];
          existing.push(fk);
          referencedBy.set(to, existing);
        }

        // BFS from source table following cascade paths
        interface AffectedEntry {
          table: string;
          schema: string;
          action: string;
          estimatedRows?: number | undefined;
          path: string[];
          depth: number;
        }

        const affected: AffectedEntry[] = [];
        const visited = new Set<string>();
        const queue: {
          tableName: string;
          path: string[];
          depth: number;
        }[] = [{ tableName: sourceQName, path: [sourceQName], depth: 0 }];
        visited.add(sourceQName);

        let cascadeActions = 0;
        let blockingActions = 0;
        let setNullActions = 0;

        while (queue.length > 0) {
          const current = queue.shift();
          if (current === undefined) break;
          const refs = referencedBy.get(current.tableName) ?? [];

          for (const ref of refs) {
            const refQName = qualifiedName(ref.fromSchema, ref.fromTable);
            const isAlreadyVisited = visited.has(refQName);
            visited.add(refQName);

            const action = operation === "DELETE" ? ref.onDelete : "CASCADE";
            const tableInfo = tableMap.get(refQName);

            if (action === "CASCADE") {
              cascadeActions++;
              affected.push({
                table: ref.fromTable,
                schema: ref.fromSchema,
                action: "CASCADE",
                estimatedRows: tableInfo?.rowCount,
                path: [...current.path, refQName],
                depth: current.depth + 1,
              });
              // Continue traversal for cascade only if not already visited (prevents infinite loops)
              if (!isAlreadyVisited) {
                queue.push({
                  tableName: refQName,
                  path: [...current.path, refQName],
                  depth: current.depth + 1,
                });
              }
            } else if (action === "RESTRICT" || action === "NO ACTION") {
              blockingActions++;
              affected.push({
                table: ref.fromTable,
                schema: ref.fromSchema,
                action,
                estimatedRows: tableInfo?.rowCount,
                path: [...current.path, refQName],
                depth: current.depth + 1,
              });
            } else if (action === "SET NULL" || action === "SET DEFAULT") {
              setNullActions++;
              affected.push({
                table: ref.fromTable,
                schema: ref.fromSchema,
                action,
                estimatedRows: tableInfo?.rowCount,
                path: [...current.path, refQName],
                depth: current.depth + 1,
              });
            }
          }
        }

        const maxDepth = affected.reduce((max, a) => Math.max(max, a.depth), 0);

        // Severity assessment
        let severity: "low" | "medium" | "high" | "critical";
        if (blockingActions > 0) {
          severity = operation === "DELETE" ? "high" : "critical"; // DELETE fail gracefully, DROP force-cascades
        } else if (operation !== "DELETE" && cascadeActions > 0) {
          severity = "critical"; // DROP/TRUNCATE force-cascades everything
        } else if (cascadeActions > 5 || maxDepth > 3) {
          severity = "high";
        } else if (cascadeActions > 0) {
          severity = "medium";
        } else {
          severity = "low";
        }

        const data = {
          sourceTable: sourceQName,
          operation,
          ...(affected.length > 0 ? { affectedTables: affected } : {}),
          severity,
          stats: {
            totalTablesAffected: affected.length,
            cascadeActions,
            blockingActions,
            setNullActions,
            maxDepth,
          },
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(data), "utf8") / 4,
        );
        return withTokenEstimate({ success: true, data, metrics: { tokenEstimate } });
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
