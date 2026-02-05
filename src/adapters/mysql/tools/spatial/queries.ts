/**
 * MySQL Spatial/GIS Tools - Spatial Queries
 *
 * Tools for querying spatial relationships and distances.
 * 4 tools: distance, distance_sphere, contains, within.
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

const DistanceSchema = z.object({
  table: z.string().describe("Table name"),
  spatialColumn: z.string().describe("Spatial column name"),
  point: z
    .object({
      longitude: z.number(),
      latitude: z.number(),
    })
    .describe("Reference point"),
  maxDistance: z.number().optional().describe("Maximum distance in meters"),
  limit: z.number().default(20).describe("Maximum results"),
  srid: z.number().default(4326).describe("SRID"),
});

const ContainsSchema = z.object({
  table: z.string().describe("Table name"),
  spatialColumn: z.string().describe("Spatial column name"),
  polygon: z.string().describe("WKT polygon to test containment"),
  limit: z.number().default(100).describe("Maximum results"),
  srid: z
    .number()
    .default(4326)
    .describe("SRID of the input geometry (default: 4326 for GPS coordinates)"),
});

const WithinSchema = z.object({
  table: z.string().describe("Table name"),
  spatialColumn: z.string().describe("Spatial column name"),
  geometry: z.string().describe("WKT geometry to test within"),
  limit: z.number().default(100).describe("Maximum results"),
  srid: z
    .number()
    .default(4326)
    .describe("SRID of the input geometry (default: 4326 for GPS coordinates)"),
});

/**
 * Calculate distance between geometries
 */
export function createSpatialDistanceTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_spatial_distance",
    title: "MySQL Spatial Distance",
    description:
      "Find rows within a certain distance from a point (Cartesian distance).",
    group: "spatial",
    inputSchema: DistanceSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, spatialColumn, point, maxDistance, limit, srid } =
        DistanceSchema.parse(params);

      // Validate identifiers
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(spatialColumn)) {
        throw new Error("Invalid column name");
      }

      // Use 'axis-order=long-lat' to accept natural longitude-latitude order
      const pointWkt = `POINT(${String(point.longitude)} ${String(point.latitude)})`;

      let query = `
                SELECT *,
                       ST_Distance(\`${spatialColumn}\`, ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')) as distance
                FROM \`${table}\`
            `;

      const queryParams: unknown[] = [pointWkt];

      if (maxDistance !== undefined) {
        query += ` WHERE ST_Distance(\`${spatialColumn}\`, ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')) <= ?`;
        queryParams.push(pointWkt, maxDistance);
      }

      query += ` ORDER BY distance LIMIT ${String(limit)}`;

      const result = await adapter.executeQuery(query, queryParams);
      return {
        results: result.rows ?? [],
        count: result.rows?.length ?? 0,
        referencePoint: point,
      };
    },
  };
}

/**
 * Calculate spherical distance
 */
export function createSpatialDistanceSphereTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_spatial_distance_sphere",
    title: "MySQL Spherical Distance",
    description:
      "Calculate distance on a sphere (for geographic coordinates). Returns distance in meters.",
    group: "spatial",
    inputSchema: DistanceSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, spatialColumn, point, maxDistance, limit, srid } =
        DistanceSchema.parse(params);

      // Validate identifiers
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(spatialColumn)) {
        throw new Error("Invalid column name");
      }

      // Use 'axis-order=long-lat' to accept natural longitude-latitude order
      const pointWkt = `POINT(${String(point.longitude)} ${String(point.latitude)})`;

      let query = `
                SELECT *,
                       ST_Distance_Sphere(\`${spatialColumn}\`, ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')) as distance_meters
                FROM \`${table}\`
            `;

      const queryParams: unknown[] = [pointWkt];

      if (maxDistance !== undefined) {
        query += ` WHERE ST_Distance_Sphere(\`${spatialColumn}\`, ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')) <= ?`;
        queryParams.push(pointWkt, maxDistance);
      }

      query += ` ORDER BY distance_meters LIMIT ${String(limit)}`;

      const result = await adapter.executeQuery(query, queryParams);
      return {
        results: result.rows ?? [],
        count: result.rows?.length ?? 0,
        referencePoint: point,
        unit: "meters",
      };
    },
  };
}

/**
 * Find geometries contained within a polygon
 */
export function createSpatialContainsTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_spatial_contains",
    title: "MySQL Spatial Contains",
    description:
      "Find rows where the geometry is contained within a specified polygon.",
    group: "spatial",
    inputSchema: ContainsSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, spatialColumn, polygon, limit, srid } =
        ContainsSchema.parse(params);

      // Validate identifiers
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(spatialColumn)) {
        throw new Error("Invalid column name");
      }

      const query = `
                SELECT *
                FROM \`${table}\`
                WHERE ST_Contains(ST_GeomFromText(?, ${String(srid)}), \`${spatialColumn}\`)
                LIMIT ${String(limit)}
            `;

      const result = await adapter.executeQuery(query, [polygon]);
      return {
        results: result.rows ?? [],
        count: result.rows?.length ?? 0,
      };
    },
  };
}

/**
 * Find geometries within another geometry
 */
export function createSpatialWithinTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_spatial_within",
    title: "MySQL Spatial Within",
    description: "Find rows where the geometry is within a specified geometry.",
    group: "spatial",
    inputSchema: WithinSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, spatialColumn, geometry, limit, srid } =
        WithinSchema.parse(params);

      // Validate identifiers
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
        throw new Error("Invalid table name");
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(spatialColumn)) {
        throw new Error("Invalid column name");
      }

      const query = `
                SELECT *
                FROM \`${table}\`
                WHERE ST_Within(\`${spatialColumn}\`, ST_GeomFromText(?, ${String(srid)}))
                LIMIT ${String(limit)}
            `;

      const result = await adapter.executeQuery(query, [geometry]);
      return {
        results: result.rows ?? [],
        count: result.rows?.length ?? 0,
      };
    },
  };
}
