/**
 * MySQL Spatial/GIS Tools - Setup and Schema Management
 *
 * Tools for creating and managing spatial columns and indexes.
 * 2 tools: column creation and index creation.
 */

import { z } from "zod";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";

// =============================================================================
// Zod Schemas
// =============================================================================

const SpatialColumnSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column name"),
  type: z
    .enum([
      "POINT",
      "LINESTRING",
      "POLYGON",
      "GEOMETRY",
      "MULTIPOINT",
      "MULTILINESTRING",
      "MULTIPOLYGON",
      "GEOMETRYCOLLECTION",
    ])
    .default("GEOMETRY")
    .describe("Geometry type"),
  srid: z
    .number()
    .default(4326)
    .describe("Spatial Reference System ID (4326 = WGS84)"),
  nullable: z.boolean().default(true).describe("Allow NULL values"),
});

const SpatialIndexSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Spatial column name"),
  indexName: z
    .string()
    .optional()
    .describe("Index name (auto-generated if not provided)"),
});

/**
 * Add a spatial column to a table
 */
export function createSpatialCreateColumnTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_spatial_create_column",
    title: "MySQL Create Spatial Column",
    description: "Add a geometry/spatial column to an existing table.",
    group: "spatial",
    inputSchema: SpatialColumnSchema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, type, srid, nullable } =
        SpatialColumnSchema.parse(params);

      // Validate identifiers
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
        throw new Error("Invalid column name");
      }

      try {
        const nullClause = nullable ? "" : " NOT NULL";
        const sridClause = srid ? ` SRID ${String(srid)}` : "";

        await adapter.executeQuery(
          `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}${sridClause}${nullClause}`,
        );

        return {
          success: true,
          table,
          column,
          type,
          srid: srid ?? null,
          nullable,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return { exists: false, table };
        }
        if (msg.includes("Duplicate column name")) {
          return {
            success: false,
            reason: `Column '${column}' already exists on table '${table}'`,
          };
        }
        return { success: false, error: msg };
      }
    },
  };
}

/**
 * Create a spatial index
 */
export function createSpatialCreateIndexTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_spatial_create_index",
    title: "MySQL Create Spatial Index",
    description:
      "Create a SPATIAL index on a geometry column for faster queries.",
    group: "spatial",
    inputSchema: SpatialIndexSchema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, indexName } = SpatialIndexSchema.parse(params);

      // Validate identifiers
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
        throw new Error("Invalid column name");
      }

      const idxName = indexName ?? `idx_spatial_${table}_${column}`;
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(idxName)) {
        throw new Error("Invalid index name");
      }

      try {
        // Check if column is nullable - SPATIAL indexes require NOT NULL
        const colInfo = await adapter.executeQuery(
          `SELECT IS_NULLABLE, DATA_TYPE FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column],
        );

        const colRow = colInfo.rows?.[0];
        if (colRow) {
          const isNullable = colRow["IS_NULLABLE"] === "YES";
          const dataType = String(colRow["DATA_TYPE"]).toUpperCase();
          if (isNullable) {
            throw new Error(
              `Cannot create SPATIAL index on nullable column '${column}'. ` +
                `Alter the column to NOT NULL first: ` +
                `ALTER TABLE \`${table}\` MODIFY \`${column}\` ${dataType} NOT NULL`,
            );
          }
        }

        // Check if a SPATIAL index already exists on this column (any name)
        const existingIdx = await adapter.executeQuery(
          `SELECT INDEX_NAME FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND INDEX_TYPE = 'SPATIAL'
           LIMIT 1`,
          [table, column],
        );

        const existingRow = existingIdx.rows?.[0];
        if (existingRow) {
          const existingName = String(existingRow["INDEX_NAME"]);
          return {
            success: false,
            reason: `Spatial index '${existingName}' already exists on column '${column}' of table '${table}'`,
          };
        }

        await adapter.executeQuery(
          `CREATE SPATIAL INDEX \`${idxName}\` ON \`${table}\`(\`${column}\`)`,
        );

        return {
          success: true,
          table,
          column,
          indexName: idxName,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return { exists: false, table };
        }
        if (msg.includes("Cannot create SPATIAL index on nullable column")) {
          return { success: false, reason: msg };
        }
        if (msg.includes("Duplicate key name")) {
          return {
            success: false,
            reason: `Index '${idxName}' already exists on table '${table}'`,
          };
        }
        return { success: false, error: msg };
      }
    },
  };
}
