import { z } from "zod";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";

const ListConstraintsSchema = z.object({
  table: z.string().describe("Table name"),
  type: z
    .enum(["PRIMARY KEY", "FOREIGN KEY", "UNIQUE", "CHECK"])
    .optional()
    .describe("Filter by constraint type"),
});

/**
 * List constraints
 */
export function createListConstraintsTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_list_constraints",
    title: "MySQL List Constraints",
    description:
      "List all constraints (primary key, foreign key, unique, check) for a table.",
    group: "schema",
    inputSchema: ListConstraintsSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, type } = ListConstraintsSchema.parse(params);

      const parts = table.split(".");
      let schemaName: string | null = null;
      let tableName = table;

      if (parts.length === 2 && parts[0] && parts[1]) {
        schemaName = parts[0];
        tableName = parts[1];
      }

      // Query for table constraints
      let query = `
                SELECT 
                    tc.CONSTRAINT_NAME as name,
                    tc.CONSTRAINT_TYPE as type,
                    tc.TABLE_NAME as tableName,
                    GROUP_CONCAT(kcu.COLUMN_NAME ORDER BY kcu.ORDINAL_POSITION) as columns,
                    kcu.REFERENCED_TABLE_NAME as referencedTable,
                    GROUP_CONCAT(kcu.REFERENCED_COLUMN_NAME ORDER BY kcu.ORDINAL_POSITION) as referencedColumns,
                    rc.UPDATE_RULE as onUpdate,
                    rc.DELETE_RULE as onDelete
                FROM information_schema.TABLE_CONSTRAINTS tc
                LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu 
                    ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME 
                    AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
                    AND tc.TABLE_NAME = kcu.TABLE_NAME
                LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
                    ON tc.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
                    AND tc.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
                WHERE tc.TABLE_SCHEMA = COALESCE(?, DATABASE())
                  AND tc.TABLE_NAME = ?
            `;

      const queryParams: unknown[] = [schemaName, tableName];

      if (type) {
        query += " AND tc.CONSTRAINT_TYPE = ?";
        queryParams.push(type);
      }

      query +=
        " GROUP BY tc.CONSTRAINT_NAME, tc.CONSTRAINT_TYPE, tc.TABLE_NAME, kcu.REFERENCED_TABLE_NAME, rc.UPDATE_RULE, rc.DELETE_RULE";
      query += " ORDER BY tc.CONSTRAINT_TYPE, tc.CONSTRAINT_NAME";

      const result = await adapter.executeQuery(query, queryParams);
      return {
        constraints: result.rows,
        count: result.rows?.length ?? 0,
      };
    },
  };
}
