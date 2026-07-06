/**
 * MySQL Spatial/GIS Tools - Spatial Queries
 *
 * Tools for querying spatial relationships and distances.
 * 4 tools: distance, distance_sphere, contains, within.
 */


import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  validateQualifiedIdentifier,
  escapeQualifiedTable,
} from "../../../../utils/validators.js";
import { ValidationError } from "../../../../utils/validators.js";
import {
  DistanceSchemaBase,
  DistanceSchema,
  ContainsSchemaBase,
  ContainsSchema,
  WithinSchemaBase,
  WithinSchema,
  SpatialQueryResultOutputSchema,
} from "../../schemas/spatial.js";
import { READ_ONLY } from "../../../../utils/annotations.js";

// =============================================================================
// Helpers
// =============================================================================

// =============================================================================

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
    inputSchema: DistanceSchemaBase,
    outputSchema: SpatialQueryResultOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, spatialColumn, point, geometry1, geometry2, maxDistance, limit, srid } =
          DistanceSchema.parse(params);

        if (!table) {
          const query = `SELECT ROUND(ST_Distance(ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat'), ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')), 5) as distance`;
          const result = await adapter.executeQuery(query, [geometry1, geometry2]);
          return withTokenEstimate({
            success: true,
            data: { distance: Number(result.rows?.[0]?.["distance"]) }
          });
        }

        // Validate identifiers
        validateQualifiedIdentifier(table, "table");
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(spatialColumn)) {
          return withTokenEstimate({
            success: false, error: "Invalid column name", code: "VALIDATION_ERROR", category: "validation", recoverable: false,
          });
        }

        // Use 'axis-order=long-lat' to accept natural longitude-latitude order
        const pointWkt = `POINT(${String(point.longitude)} ${String(point.latitude)})`;
        const escapedTable = escapeQualifiedTable(table);

        let query = `
                SELECT *, ST_AsText(\`${spatialColumn}\`, 'axis-order=long-lat') as ${spatialColumn}_wkt,
                       ROUND(ST_Distance(\`${spatialColumn}\`, ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')), 5) as distance
                FROM ${escapedTable}
            `;

        const queryParams: unknown[] = [pointWkt];

        if (maxDistance !== undefined) {
          query += ` WHERE ST_Distance(\`${spatialColumn}\`, ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')) <= ?`;
          queryParams.push(pointWkt, maxDistance);
        }

        query += ` ORDER BY distance LIMIT ${String(limit)}`;

        const result = await adapter.executeQuery(query, queryParams);
        // Strip raw binary spatial column from each row
        const rows = (result.rows ?? []).map((row: Record<string, unknown>) =>
          Object.fromEntries(
            Object.entries(row).filter(([key]) => key !== spatialColumn),
          ),
        );
        return withTokenEstimate({
          success: true,
          data: {
            results: rows,
            count: rows.length,
            referencePoint: point,
          },
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          return withTokenEstimate({ success: false, error: error.message, code: "VALIDATION_ERROR", category: "validation", recoverable: false });
        }
        return formatHandlerErrorResponse(error);
      }
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
    inputSchema: DistanceSchemaBase,
    outputSchema: SpatialQueryResultOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, spatialColumn, point, geometry1, geometry2, maxDistance, limit, srid } =
          DistanceSchema.parse(params);

        if (!table) {
          const query = `SELECT ROUND(ST_Distance_Sphere(ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat'), ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')), 5) as distance_meters`;
          const result = await adapter.executeQuery(query, [geometry1, geometry2]);
          return withTokenEstimate({
            success: true,
            data: { distance: Number(result.rows?.[0]?.["distance_meters"]), unit: "meters" }
          });
        }

        // Validate identifiers
        validateQualifiedIdentifier(table, "table");
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(spatialColumn)) {
          return withTokenEstimate({
            success: false, error: "Invalid column name", code: "VALIDATION_ERROR", category: "validation", recoverable: false,
          });
        }

        // Use 'axis-order=long-lat' to accept natural longitude-latitude order
        const pointWkt = `POINT(${String(point.longitude)} ${String(point.latitude)})`;
        const escapedTable = escapeQualifiedTable(table);

        let query = `
                SELECT *, ST_AsText(\`${spatialColumn}\`, 'axis-order=long-lat') as ${spatialColumn}_wkt,
                       ROUND(ST_Distance_Sphere(\`${spatialColumn}\`, ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')), 5) as distance_meters
                FROM ${escapedTable}
            `;

        const queryParams: unknown[] = [pointWkt];

        if (maxDistance !== undefined) {
          query += ` WHERE ST_Distance_Sphere(\`${spatialColumn}\`, ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat')) <= ?`;
          queryParams.push(pointWkt, maxDistance);
        }

        query += ` ORDER BY distance_meters LIMIT ${String(limit)}`;

        const result = await adapter.executeQuery(query, queryParams);
        // Strip raw binary spatial column from each row
        const rows = (result.rows ?? []).map((row: Record<string, unknown>) =>
          Object.fromEntries(
            Object.entries(row).filter(([key]) => key !== spatialColumn),
          ),
        );
        return withTokenEstimate({
          success: true,
          data: {
            results: rows,
            count: rows.length,
            referencePoint: point,
            unit: "meters",
          },
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          return withTokenEstimate({ success: false, error: error.message, code: "VALIDATION_ERROR", category: "validation", recoverable: false });
        }
        return formatHandlerErrorResponse(error);
      }
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
    inputSchema: ContainsSchemaBase,
    outputSchema: SpatialQueryResultOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, spatialColumn, polygon, limit, srid } =
          ContainsSchema.parse(params);

        // Validate identifiers
        validateQualifiedIdentifier(table, "table");
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(spatialColumn)) {
          return withTokenEstimate({
            success: false, error: "Invalid column name", code: "VALIDATION_ERROR", category: "validation", recoverable: false,
          });
        }

        const escapedTable = escapeQualifiedTable(table);
        const query = `
                SELECT *, ST_AsText(\`${spatialColumn}\`, 'axis-order=long-lat') as ${spatialColumn}_wkt
                FROM ${escapedTable}
                WHERE ST_Contains(ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat'), \`${spatialColumn}\`)
                LIMIT ${String(limit)}
            `;

        const result = await adapter.executeQuery(query, [polygon]);
        // Strip raw binary spatial column from each row
        const rows = (result.rows ?? []).map((row: Record<string, unknown>) =>
          Object.fromEntries(
            Object.entries(row).filter(([key]) => key !== spatialColumn),
          ),
        );
        return withTokenEstimate({
          success: true,
          data: {
            results: rows,
            count: rows.length,
          },
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          return withTokenEstimate({ success: false, error: error.message, code: "VALIDATION_ERROR", category: "validation", recoverable: false });
        }
        return formatHandlerErrorResponse(error);
      }
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
    inputSchema: WithinSchemaBase,
    outputSchema: SpatialQueryResultOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, spatialColumn, geometry, limit, srid } =
          WithinSchema.parse(params);

        // Validate identifiers
        validateQualifiedIdentifier(table, "table");
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(spatialColumn)) {
          return withTokenEstimate({
            success: false, error: "Invalid column name", code: "VALIDATION_ERROR", category: "validation", recoverable: false,
          });
        }

        const escapedTable = escapeQualifiedTable(table);
        const query = `
                SELECT *, ST_AsText(\`${spatialColumn}\`, 'axis-order=long-lat') as ${spatialColumn}_wkt
                FROM ${escapedTable}
                WHERE ST_Within(\`${spatialColumn}\`, ST_GeomFromText(?, ${String(srid)}, 'axis-order=long-lat'))
                LIMIT ${String(limit)}
            `;

        const result = await adapter.executeQuery(query, [geometry]);
        // Strip raw binary spatial column from each row
        const rows = (result.rows ?? []).map((row: Record<string, unknown>) =>
          Object.fromEntries(
            Object.entries(row).filter(([key]) => key !== spatialColumn),
          ),
        );
        return withTokenEstimate({
          success: true,
          data: {
            results: rows,
            count: rows.length,
          },
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          return withTokenEstimate({ success: false, error: error.message, code: "VALIDATION_ERROR", category: "validation", recoverable: false });
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
