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
  TopologicalSortSchemaBase,
  TopologicalSortSchema,
  TopologicalSortOutputSchema,
} from "../../../schemas/index.js";
import { MySQLMcpError } from "../../../../../types/modules/errors.js";
import { ErrorCategory } from "../../../../../types/modules/error-types.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import {
  fetchForeignKeys,
  fetchTableNodes,
  qualifiedName,
  checkSchemaExists,
} from "../helpers.js";
import {
  detectCycles,
  topologicalSort,
} from "../algorithms.js";

export function createTopologicalSortTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_topological_sort",
    title: "Topological Sort",
    description:
      "Get tables in safe DDL execution order. 'create' direction: dependencies first (for CREATE TABLE). 'drop' direction: dependents first (for DROP TABLE).",
    group: "introspection",
    inputSchema: TopologicalSortSchemaBase,
    outputSchema: TopologicalSortOutputSchema,
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = TopologicalSortSchema.parse(params);

        // Validate schema existence when filtering by schema
        await checkSchemaExists(adapter, parsed.schema);

        const direction = parsed.direction ?? "create";

        const fks = await fetchForeignKeys(adapter, parsed.schema);
        const tables = await fetchTableNodes(adapter, parsed.schema);

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
            {
              suggestion:
                "Redesign schema to break the circular reference or defer constraints during operations",
              recoverable: false,
            },
          );
        }

        const data = {
          ...(order.length > 0 ? { order } : {}),
          direction,
          hasCycles: false,
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
