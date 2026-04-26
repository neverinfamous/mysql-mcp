/**
 * MySQL Introspection Tools - Graph Analysis
 *
 * Dependency graph, topological sort, and cascade simulation tools.
 * 3 tools total.
 */

import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { formatHandlerErrorResponse } from "../core/error-helpers.js";
import {
  DependencyGraphSchemaBase,
  DependencyGraphSchema,
  TopologicalSortSchemaBase,
  TopologicalSortSchema,
  CascadeSimulatorSchemaBase,
  CascadeSimulatorSchema,
  // Output schemas
} from "../../schemas/index.js";
import { MySQLMcpError } from "../../../../types/modules/errors.js";
import { ErrorCategory } from "../../../../types/modules/error-types.js";

// Shared helpers
import type { FkEdge } from "./helpers.js";
import {
  fetchForeignKeys,
  fetchTableNodes,
  qualifiedName,
  checkSchemaExists,
} from "./helpers.js";

// Graph algorithms
import {
  detectCycles,
  topologicalSort,
  calculateMaxDepth,
} from "./algorithms.js";

// Re-export helpers and algorithms for consumers
export {
  qualifiedName,
  checkSchemaExists,
  checkTableExists,
  fetchForeignKeys,
  fetchTableNodes,
} from "./helpers.js";
export type { FkEdge, TableNode } from "./helpers.js";
export {
  detectCycles,
  topologicalSort,
  calculateMaxDepth,
} from "./algorithms.js";

// =============================================================================
// mysql_dependency_graph
// =============================================================================

export function createDependencyGraphTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_dependency_graph",
    description:
      "Get the full foreign key dependency graph with cascade paths, row counts, circular dependency detection, and severity assessment. Agent-optimized structured output.",
    group: "introspection",
    inputSchema: DependencyGraphSchemaBase,
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = DependencyGraphSchema.parse(params);

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
              for (const dependent of (reverseAdjacency.get(node) ?? [])) {
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

        return {
          success: true,
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
          hint: isTruncated
            ? `Result truncated to ${String(limit)} nodes. Use 'schema' filter to narrow the graph.`
            : undefined,
        };
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

// =============================================================================
// mysql_topological_sort
// =============================================================================

export function createTopologicalSortTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_topological_sort",
    description:
      "Get tables in safe DDL execution order. 'create' direction: dependencies first (for CREATE TABLE). 'drop' direction: dependents first (for DROP TABLE).",
    group: "introspection",
    inputSchema: TopologicalSortSchemaBase,
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = TopologicalSortSchema.parse(params);

        // Validate schema existence when filtering by schema
        await checkSchemaExists(adapter, parsed.schema);

        const direction = parsed.direction ?? "create";

        const fks = await fetchForeignKeys(adapter, parsed.schema);
        const tables = await fetchTableNodes(
          adapter,
          parsed.schema,
        );

        // Build all graph structures in a single FK iteration (PERF-P3)
        const adjacency = new Map<string, string[]>();
        const allNodes = new Set<string>();
        const dependsOn = new Map<string, Set<string>>();
        // Pre-compute create-direction adjacency for level computation in drop mode
        const createAdj = new Map<string, string[]>();

        for (const t of tables) {
          allNodes.add(qualifiedName(t.schema, t.table));
        }
        for (const fk of fks) {
          const from = qualifiedName(fk.fromSchema, fk.fromTable);
          const to = qualifiedName(fk.toSchema, fk.toTable);
          allNodes.add(from);
          allNodes.add(to);

          if (from === to) continue; // Self-references don't affect ordering

          // dependsOn: from depends on to
          const deps = dependsOn.get(from) ?? new Set<string>();
          deps.add(to);
          dependsOn.set(from, deps);

          // adjacency for requested direction
          if (direction === "create") {
            const existing = adjacency.get(to) ?? [];
            existing.push(from);
            adjacency.set(to, existing);
          } else {
            const existing = adjacency.get(from) ?? [];
            existing.push(to);
            adjacency.set(from, existing);

            // Also build create-direction adjacency for level computation
            const createExisting = createAdj.get(to) ?? [];
            createExisting.push(from);
            createAdj.set(to, createExisting);
          }
        }

        const sorted = topologicalSort(adjacency, allNodes);
        const cycles = sorted === null ? detectCycles(adjacency) : [];

        // Compute level (depth in the dependency graph)
        // Always use create-order traversal for consistent levels regardless of direction
        const levelMap = new Map<string, number>();
        if (sorted) {
          // For create direction, sorted is already in dependency order.
          // For drop direction, use pre-computed create-direction adjacency.
          let createOrder: string[];
          if (direction === "create") {
            createOrder = sorted;
          } else {
            createOrder =
              topologicalSort(createAdj, allNodes) ?? [...allNodes].sort();
          }
          for (const node of createOrder) {
            const deps = dependsOn.get(node);
            if (!deps || deps.size === 0) {
              levelMap.set(node, 0);
            } else {
              let maxParentLevel = 0;
              for (const dep of deps) {
                const parentLevel = levelMap.get(dep) ?? 0;
                if (parentLevel >= maxParentLevel) {
                  maxParentLevel = parentLevel + 1;
                }
              }
              levelMap.set(node, maxParentLevel);
            }
          }
        }

        const order = (sorted ?? [...allNodes].sort()).map((name) => {
          const parts = name.split(".");
          return {
            table: parts[1] ?? name,
            schema: parts[0] ?? "mysql",
            level: levelMap.get(name) ?? 0,
            ...((dependsOn.get(name) ?? new Set()).size > 0
              ? { dependencies: [...(dependsOn.get(name) ?? [])].sort() }
              : {}),
          };
        });

        if (sorted === null || cycles.length > 0) {
          throw new MySQLMcpError(
            `Circular dependency cycle detected: ${cycles.map((c) => c.join(" -> ")).join(", ")}`,
            "CIRCULAR_DEPENDENCY",
            ErrorCategory.VALIDATION,
            { suggestion: "Redesign schema to break the circular reference or defer constraints during operations", recoverable: false }
          );
        }

        return {
          success: true,
          ...(order.length > 0 ? { order } : {}),
          direction,
          hasCycles: false,
        };
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

// =============================================================================
// mysql_cascade_simulator
// =============================================================================

export function createCascadeSimulatorTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_cascade_simulator",
    description:
      "Simulate the impact of DELETE, DROP, or TRUNCATE on a table. Returns affected tables, estimated row counts, cascade paths, and severity assessment.",
    group: "introspection",
    inputSchema: CascadeSimulatorSchemaBase,
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = CascadeSimulatorSchema.parse(params);
        let schema = parsed.schema;
        
        if (!schema) {
          const dbRow = (await adapter.executeReadQuery("SELECT DATABASE() as db")).rows?.[0];
          schema = (dbRow?.["db"] as string) || "mysql";
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
            { suggestion: "Ensure you are specifying the correct table and schema.", recoverable: true }
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

        return {
          success: true,
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
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
