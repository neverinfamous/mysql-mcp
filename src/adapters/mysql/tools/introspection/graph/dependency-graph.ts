import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { ValidationError } from "../../../../../types/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import {
  DependencyGraphSchemaBase,
  DependencyGraphSchema,
  DependencyGraphOutputSchema,
} from "../../../schemas/index.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import {
  fetchForeignKeys,
  fetchTableNodes,
  qualifiedName,
  checkSchemaExists,
} from "../helpers.js";
import {
  detectCycles,
  calculateMaxDepth,
} from "../algorithms.js";

export function createDependencyGraphTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_dependency_graph",
    title: "Dependency Graph",
    description:
      "Get the full foreign key dependency graph with cascade paths, row counts, circular dependency detection, and severity assessment. Agent-optimized structured output.",
    group: "introspection",
    inputSchema: DependencyGraphSchemaBase,
    outputSchema: DependencyGraphOutputSchema,
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = DependencyGraphSchema.parse(params) as {
          schema: string;
          compact?: boolean;
          includeRowCounts?: boolean;
          limit?: number;
          maxDepth?: number;
        };

        if (!parsed.schema) {
          throw new ValidationError("schema parameter is required");
        }

        // Validate schema existence when filtering by schema
        await checkSchemaExists(adapter, parsed.schema);

        const includeRowCounts =
          parsed.includeRowCounts !== false && !parsed.compact;

        const [fks, tables] = await Promise.all([
          fetchForeignKeys(adapter, parsed.schema),
          includeRowCounts
            ? fetchTableNodes(adapter, parsed.schema)
            : Promise.resolve([]),
        ]);

        const tableMap = new Map(
          tables.map((t) => [qualifiedName(t.schema, t.table), t]),
        );

        // Build adjacency list (from → to, meaning "from" depends on "to")
        const adjacency = new Map<string, string[]>();
        const allNodes = new Set<string>();

        // Ensure all tables are in the node set even if they have no FKs
        for (const t of tables) {
          allNodes.add(qualifiedName(t.schema, t.table));
        }

        for (const fk of fks) {
          const from = qualifiedName(fk.fromSchema, fk.fromTable);
          const to = qualifiedName(fk.toSchema, fk.toTable);
          allNodes.add(from);
          allNodes.add(to);

          const existing = adjacency.get(from) ?? [];
          existing.push(to);
          adjacency.set(from, existing);
        }

        // Find root tables (no dependencies) and leaf tables (no dependents)
        const dependents = new Set<string>();
        for (const [, neighbors] of adjacency) {
          for (const n of neighbors) {
            dependents.add(n);
          }
        }
        const rootTables = [...allNodes]
          .filter(
            (n) => !adjacency.has(n) || (adjacency.get(n)?.length ?? 0) === 0,
          )
          .sort();
        const leafTables = [...allNodes]
          .filter((n) => !dependents.has(n))
          .sort();

        // Detect cycles
        const cycles = detectCycles(adjacency);
        const maxDepth = calculateMaxDepth(adjacency, leafTables);

        const limit = Math.min(Math.max(parsed.limit ?? 100, 1), 500);
        const originalNodeCount = allNodes.size;

        // Filter by maxDepth if specified
        if (parsed.maxDepth !== undefined && parsed.maxDepth >= 0) {
          const nodeDepth = new Map<string, number>();
          for (const root of rootTables) {
            nodeDepth.set(root, 0);
          }

          const reverseAdjacency = new Map<string, string[]>();
          for (const [from, tos] of adjacency) {
            for (const to of tos) {
              const existing = reverseAdjacency.get(to) ?? [];
              existing.push(from);
              reverseAdjacency.set(to, existing);
            }
          }

          let currentLevel = [...rootTables];
          let depth = 0;
          while (currentLevel.length > 0 && depth < parsed.maxDepth) {
            const nextLevel = [];
            for (const node of currentLevel) {
              for (const dependent of reverseAdjacency.get(node) ?? []) {
                if (!nodeDepth.has(dependent)) {
                  nodeDepth.set(dependent, depth + 1);
                  nextLevel.push(dependent);
                }
              }
            }
            currentLevel = nextLevel;
            depth++;
          }

          const allowedNodes = new Set<string>();
          for (const node of allNodes) {
            const d = nodeDepth.get(node);
            if (d !== undefined && d <= parsed.maxDepth) {
              allowedNodes.add(node);
            }
          }

          const filteredOut = new Set<string>();
          for (const node of allNodes) {
            if (!allowedNodes.has(node)) {
              filteredOut.add(node);
            }
          }

          for (const node of filteredOut) {
            allNodes.delete(node);
          }
        }

        // Truncate nodes if needed
        let finalNodes = [...allNodes].sort();
        const isTruncated = finalNodes.length > limit;
        if (isTruncated) {
          finalNodes = finalNodes.slice(0, limit);
        }
        const activeNodes = new Set(finalNodes);

        // Build nodes
        const nodes = finalNodes.map((name) => {
          const info = tableMap.get(name);
          const parts = name.split(".");
          return {
            table: parts[1] ?? name,
            schema: parts[0] ?? "mysql",
            ...(includeRowCounts && info
              ? { rowCount: info.rowCount, sizeBytes: info.sizeBytes }
              : {}),
          };
        });

        // Build edges (only for active nodes)
        const finalEdges = fks.filter(
          (fk) =>
            activeNodes.has(qualifiedName(fk.fromSchema, fk.fromTable)) &&
            activeNodes.has(qualifiedName(fk.toSchema, fk.toTable)),
        );

        const edges = parsed.compact
          ? finalEdges.map((fk) => ({
              from: qualifiedName(fk.fromSchema, fk.fromTable),
              to: qualifiedName(fk.toSchema, fk.toTable),
            }))
          : finalEdges.map((fk) => ({
              from: qualifiedName(fk.fromSchema, fk.fromTable),
              to: qualifiedName(fk.toSchema, fk.toTable),
              constraint: fk.constraintName,
              columns: fk.fromColumns.map((col, i) => ({
                from: col,
                to: fk.toColumns[i] ?? col,
              })),
              onDelete: fk.onDelete,
              onUpdate: fk.onUpdate,
            }));

        const data = {
          ...(nodes.length > 0 ? { nodes } : {}),
          ...(edges.length > 0 ? { edges } : {}),
          ...(cycles.length > 0 ? { circularDependencies: cycles } : {}),
          stats: {
            totalTables: originalNodeCount,
            totalRelationships: fks.length,
            maxDepth,
            ...(parsed.compact
              ? {}
              : {
                  ...(rootTables.length > 0 ? { rootTables } : {}),
                  ...(leafTables.length > 0 ? { leafTables } : {}),
                }),
          },
          ...(isTruncated
            ? {
                hint: `Result truncated to ${String(limit)} nodes. Use 'schema' filter to narrow the graph.`,
              }
            : {}),
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
