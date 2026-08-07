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

async function validateSpatialColumn(adapter: MySQLAdapter, table: string, spatialColumn: string): Promise<{ success: boolean; error?: string; code?: string; srid?: number }> {
  try {
    const tableName = table.includes('.') ? (table.split('.')[1] || table) : table;
    const tableCheck = await adapter.executeReadQuery(
      `SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
      [tableName]
    );
    if (!tableCheck.rows || tableCheck.rows.length === 0) {
      return { success: false, error: `Table '${table}' does not exist`, code: "TABLE_NOT_FOUND" };
    }

    // Column name is already validated as a strict alphanumeric identifier before this is called
    const colCheck = await adapter.executeReadQuery(
      `SELECT DATA_TYPE, SRS_ID FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
      [tableName, spatialColumn]
    );
    if (!colCheck.rows || colCheck.rows.length === 0) {
      return { success: false, error: `Column '${spatialColumn}' not found in table '${table}'`, code: "COLUMN_NOT_FOUND" };
    }
    const dataType = String(colCheck.rows?.[0]?.["DATA_TYPE"]).toLowerCase();
    if (!["geometry", "point", "multipoint", "polygon", "multipolygon", "linestring", "multilinestring"].includes(dataType)) {
      return { success: false, error: `Column '${spatialColumn}' is not a spatial data type (found ${dataType})`, code: "VALIDATION_ERROR" };
    }
    const srsId = colCheck.rows?.[0]?.["SRS_ID"];
    return { success: true, srid: srsId !== null && srsId !== undefined ? Number(srsId) : undefined };
  } catch {
    // If information_schema query fails, just proceed to let MySQL handle it
    return { success: true };
  }
}

async function validateSrid(adapter: MySQLAdapter, srid: number): Promise<{ success: boolean; error?: string }> {
  if (srid === 0 || srid === 4326) return { success: true };
  try {
    const sridCheck = await adapter.executeReadQuery(
      `SELECT SRS_ID FROM information_schema.st_spatial_reference_systems WHERE SRS_ID = ?`,
      [srid]
    );
    if (!sridCheck.rows || sridCheck.rows.length === 0) {
      return { success: false, error: `Invalid SRID: ${srid}. No such spatial reference system exists in MySQL.` };
    }
    return { success: true };
  } catch {
    return { success: true };
  }
}

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

        const sridValidation = await validateSrid(adapter, srid);
        if (!sridValidation.success) {
          return withTokenEstimate({
            success: false, error: sridValidation.error || "Validation error", code: "VALIDATION_ERROR", category: "validation", recoverable: false
          });
        }

        if (!table) {
          const sridNum = srid;
          const axisOrder = sridNum !== 0 ? `, 'axis-order=long-lat'` : "";
          const query = `(SELECT ROUND(ST_Distance(ST_GeomFromText(?, ${sridNum}${axisOrder}), ST_GeomFromText(?, ${sridNum}${axisOrder})), 5) as distance)`;
          const result = await adapter.executeReadQuery(query, [geometry1, geometry2]);
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

        const colValidation = await validateSpatialColumn(adapter, table, spatialColumn);
        if (!colValidation.success) {
          const details = colValidation.code === "TABLE_NOT_FOUND" ? { exists: false, table } : undefined;
          return withTokenEstimate({
            success: false, error: colValidation.error || "Validation error", code: colValidation.code || "VALIDATION_ERROR", category: colValidation.code?.includes("NOT_FOUND") ? "resource" : "validation", recoverable: false, ...(details ? { details } : {})
          });
        }
        if (colValidation.srid !== undefined && colValidation.srid !== srid) {
          return withTokenEstimate({
            success: false,
            error: `SRID mismatch: The column '${spatialColumn}' has SRID ${colValidation.srid}, but the tool was called with SRID ${srid}. MySQL requires matching SRIDs for spatial table comparisons.`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false
          });
        }

        // Use 'axis-order=long-lat' to accept natural longitude-latitude order (only for non-zero SRIDs)
        const pointWkt = `POINT(${String(point.longitude)} ${String(point.latitude)})`;
        const escapedTable = escapeQualifiedTable(table);
        const sridNum = srid;
        const axisOrder = sridNum !== 0 ? `, 'axis-order=long-lat'` : "";

        let query = `(SELECT *, ST_AsText(\`${spatialColumn}\`${axisOrder}) as ${spatialColumn}_wkt,
                       ROUND(ST_Distance(\`${spatialColumn}\`, ST_GeomFromText(?, ${sridNum}${axisOrder})), 5) as distance
                FROM ${escapedTable}`;

        const queryParams: unknown[] = [pointWkt];

        if (maxDistance !== undefined) {
          query += ` HAVING distance <= ?`;
          queryParams.push(maxDistance);
        }

        query += ` ORDER BY distance LIMIT ${String(limit)})`;

        const result = await adapter.executeReadQuery(query, queryParams);
        // Strip raw binary spatial column from each row
        const rows = (result.rows ?? []).map((row: Record<string, unknown>) =>
          Object.fromEntries(
            Object.entries(row).filter(([key]) => key.toLowerCase() !== spatialColumn.toLowerCase()),
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
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("Table") && (msg.includes("does not exist") || msg.includes("doesn't exist"))) {
          const paramsRec = params as Record<string, unknown> | undefined;
          const tblObj = paramsRec?.['table'] ?? paramsRec?.['tableName'] ?? paramsRec?.['name'];
          const tbl = typeof tblObj === "string" ? tblObj : "unknown";
          return withTokenEstimate({
            success: false, error: `Table '${tbl}' does not exist`, code: "TABLE_NOT_FOUND", category: "resource", recoverable: false,
            details: { exists: false, table: tbl },
          });
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

        const validateGeometry = (geom: unknown): boolean => {
            if (typeof geom === "string" && geom && !geom.toUpperCase().includes('POINT') && !geom.toUpperCase().includes('MULTIPOINT')) {
                return false;
            }
            return true;
        };

        if (!validateGeometry(geometry1) || !validateGeometry(geometry2)) {
            return withTokenEstimate({
                success: false, 
                error: "Validation error: ST_Distance_Sphere only supports POINT and MULTIPOINT geometries", 
                code: "VALIDATION_ERROR", 
                category: "validation", 
                recoverable: false
            });
        }

        const validateCoordinates = (geom: unknown): string | null => {
            if (typeof geom !== "string") return null;
            const matches = geom.match(/[-\d.]+\s+[-\d.]+/g);
            if (matches) {
                for (const match of matches) {
                    const [lonStr, latStr] = match.split(/\s+/);
                    const lon = Number(lonStr);
                    const lat = Number(latStr);
                    if (lon < -180 || lon > 180) return "longitude must be between -180 and 180";
                    if (lat < -90 || lat > 90) return "latitude must be between -90 and 90";
                }
            }
            return null;
        };

        if (table) {
            if (point.longitude < -180 || point.longitude > 180) {
                return withTokenEstimate({ success: false, error: "Validation error: longitude must be between -180 and 180", code: "VALIDATION_ERROR", category: "validation", recoverable: false });
            }
            if (point.latitude < -90 || point.latitude > 90) {
                return withTokenEstimate({ success: false, error: "Validation error: latitude must be between -90 and 90", code: "VALIDATION_ERROR", category: "validation", recoverable: false });
            }
        } else {
            const err1 = validateCoordinates(geometry1);
            if (err1) return withTokenEstimate({ success: false, error: `Validation error: ${err1}`, code: "VALIDATION_ERROR", category: "validation", recoverable: false });
            const err2 = validateCoordinates(geometry2);
            if (err2) return withTokenEstimate({ success: false, error: `Validation error: ${err2}`, code: "VALIDATION_ERROR", category: "validation", recoverable: false });
        }

        if (srid !== 0 && srid !== 4326) {
            return withTokenEstimate({
                success: false, 
                error: "Validation error: ST_Distance_Sphere only supports SRID 0 (Cartesian) and SRID 4326 (WGS 84 geographic). Other SRIDs may cause server errors.", 
                code: "VALIDATION_ERROR", 
                category: "validation", 
                recoverable: false
            });
        }

        if (!table) {
          const sridNum = srid;
          const axisOrder = sridNum !== 0 ? `, 'axis-order=long-lat'` : "";
          const query = `(SELECT ROUND(ST_Distance_Sphere(ST_GeomFromText(?, ${sridNum}${axisOrder}), ST_GeomFromText(?, ${sridNum}${axisOrder})), 5) as distance_meters)`;
          const result = await adapter.executeReadQuery(query, [geometry1, geometry2]);
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

        const colValidation = await validateSpatialColumn(adapter, table, spatialColumn);
        if (!colValidation.success) {
          const details = colValidation.code === "TABLE_NOT_FOUND" ? { exists: false, table } : undefined;
          return withTokenEstimate({
            success: false, error: colValidation.error || "Validation error", code: colValidation.code || "VALIDATION_ERROR", category: colValidation.code?.includes("NOT_FOUND") ? "resource" : "validation", recoverable: false, ...(details ? { details } : {})
          });
        }
        if (colValidation.srid !== undefined && colValidation.srid !== srid) {
          return withTokenEstimate({
            success: false,
            error: `SRID mismatch: The column '${spatialColumn}' has SRID ${colValidation.srid}, but the tool was called with SRID ${srid}. MySQL requires matching SRIDs for spatial table comparisons.`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false
          });
        }

        // Use 'axis-order=long-lat' to accept natural longitude-latitude order (only for non-zero SRIDs)
        const pointWkt = `POINT(${String(point.longitude)} ${String(point.latitude)})`;
        const escapedTable = escapeQualifiedTable(table);
        const sridNum = srid;
        const axisOrder = sridNum !== 0 ? `, 'axis-order=long-lat'` : "";

        let query = `(SELECT *, ST_AsText(\`${spatialColumn}\`${axisOrder}) as ${spatialColumn}_wkt,
                       ROUND(ST_Distance_Sphere(
                           IF(ST_GeometryType(\`${spatialColumn}\`) IN ('POINT', 'MULTIPOINT'), \`${spatialColumn}\`, ST_GeomFromText('POINT(0 0)', ${sridNum})), 
                           ST_GeomFromText(?, ${sridNum}${axisOrder})
                       ), 5) as distance_meters
                FROM ${escapedTable}
                WHERE ST_GeometryType(\`${spatialColumn}\`) IN ('POINT', 'MULTIPOINT')`;

        const queryParams: unknown[] = [pointWkt];

        if (maxDistance !== undefined) {
          query += ` HAVING distance_meters <= ?`;
          queryParams.push(maxDistance);
        }

        query += ` ORDER BY distance_meters LIMIT ${String(limit)})`;

        const result = await adapter.executeReadQuery(query, queryParams);
        // Strip raw binary spatial column from each row
        const rows = (result.rows ?? []).map((row: Record<string, unknown>) =>
          Object.fromEntries(
            Object.entries(row).filter(([key]) => key.toLowerCase() !== spatialColumn.toLowerCase()),
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
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("Table") && (msg.includes("does not exist") || msg.includes("doesn't exist"))) {
          const paramsRec = params as Record<string, unknown> | undefined;
          const tblObj = paramsRec?.['table'] ?? paramsRec?.['tableName'] ?? paramsRec?.['name'];
          const tbl = typeof tblObj === "string" ? tblObj : "unknown";
          return withTokenEstimate({
            success: false, error: `Table '${tbl}' does not exist`, code: "TABLE_NOT_FOUND", category: "resource", recoverable: false,
            details: { exists: false, table: tbl },
          });
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

        const sridValidation = await validateSrid(adapter, srid);
        if (!sridValidation.success) {
          return withTokenEstimate({
            success: false, error: sridValidation.error || "Validation error", code: "VALIDATION_ERROR", category: "validation", recoverable: false
          });
        }

        // Validate identifiers
        validateQualifiedIdentifier(table, "table");
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(spatialColumn)) {
          return withTokenEstimate({
            success: false, error: "Invalid column name", code: "VALIDATION_ERROR", category: "validation", recoverable: false,
          });
        }

        const colValidation = await validateSpatialColumn(adapter, table, spatialColumn);
        if (!colValidation.success) {
          const details = colValidation.code === "TABLE_NOT_FOUND" ? { exists: false, table } : undefined;
          return withTokenEstimate({
            success: false, error: colValidation.error || "Validation error", code: colValidation.code || "VALIDATION_ERROR", category: colValidation.code?.includes("NOT_FOUND") ? "resource" : "validation", recoverable: false, ...(details ? { details } : {})
          });
        }
        if (colValidation.srid !== undefined && colValidation.srid !== srid) {
          return withTokenEstimate({
            success: false,
            error: `SRID mismatch: The column '${spatialColumn}' has SRID ${colValidation.srid}, but the tool was called with SRID ${srid}. MySQL requires matching SRIDs for spatial table comparisons.`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false
          });
        }

        const sridNum = srid;
        const axisOrder = sridNum !== 0 ? `, 'axis-order=long-lat'` : "";
        const escapedTable = escapeQualifiedTable(table);
        const query = `(SELECT *, ST_AsText(\`${spatialColumn}\`${axisOrder}) as ${spatialColumn}_wkt
                FROM ${escapedTable}
                WHERE ST_Contains(ST_GeomFromText(?, ${String(sridNum)}${axisOrder}), \`${spatialColumn}\`)
                LIMIT ${String(limit)})`;

        const result = await adapter.executeReadQuery(query, [polygon]);
        // Strip raw binary spatial column from each row
        const rows = (result.rows ?? []).map((row: Record<string, unknown>) =>
          Object.fromEntries(
            Object.entries(row).filter(([key]) => key.toLowerCase() !== spatialColumn.toLowerCase()),
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
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("Table") && (msg.includes("does not exist") || msg.includes("doesn't exist"))) {
          const paramsRec = params as Record<string, unknown> | undefined;
          const tblObj = paramsRec?.['table'] ?? paramsRec?.['tableName'] ?? paramsRec?.['name'];
          const tbl = typeof tblObj === "string" ? tblObj : "unknown";
          return withTokenEstimate({
            success: false, error: `Table '${tbl}' does not exist`, code: "TABLE_NOT_FOUND", category: "resource", recoverable: false,
            details: { exists: false, table: tbl },
          });
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

        const sridValidation = await validateSrid(adapter, srid);
        if (!sridValidation.success) {
          return withTokenEstimate({
            success: false, error: sridValidation.error || "Validation error", code: "VALIDATION_ERROR", category: "validation", recoverable: false
          });
        }

        // Validate identifiers
        validateQualifiedIdentifier(table, "table");
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(spatialColumn)) {
          return withTokenEstimate({
            success: false, error: "Invalid column name", code: "VALIDATION_ERROR", category: "validation", recoverable: false,
          });
        }

        const colValidation = await validateSpatialColumn(adapter, table, spatialColumn);
        if (!colValidation.success) {
          const details = colValidation.code === "TABLE_NOT_FOUND" ? { exists: false, table } : undefined;
          return withTokenEstimate({
            success: false, error: colValidation.error || "Validation error", code: colValidation.code || "VALIDATION_ERROR", category: colValidation.code?.includes("NOT_FOUND") ? "resource" : "validation", recoverable: false, ...(details ? { details } : {})
          });
        }
        if (colValidation.srid !== undefined && colValidation.srid !== srid) {
          return withTokenEstimate({
            success: false,
            error: `SRID mismatch: The column '${spatialColumn}' has SRID ${colValidation.srid}, but the tool was called with SRID ${srid}. MySQL requires matching SRIDs for spatial table comparisons.`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: false
          });
        }

        const sridNum = srid;
        const axisOrder = sridNum !== 0 ? `, 'axis-order=long-lat'` : "";
        const escapedTable = escapeQualifiedTable(table);
        const query = `(SELECT *, ST_AsText(\`${spatialColumn}\`${axisOrder}) as ${spatialColumn}_wkt
                FROM ${escapedTable}
                WHERE ST_Within(\`${spatialColumn}\`, ST_GeomFromText(?, ${String(sridNum)}${axisOrder}))
                LIMIT ${String(limit)})`;

        const result = await adapter.executeReadQuery(query, [geometry]);
        // Strip raw binary spatial column from each row
        const rows = (result.rows ?? []).map((row: Record<string, unknown>) =>
          Object.fromEntries(
            Object.entries(row).filter(([key]) => key.toLowerCase() !== spatialColumn.toLowerCase()),
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
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("Table") && (msg.includes("does not exist") || msg.includes("doesn't exist"))) {
          const paramsRec = params as Record<string, unknown> | undefined;
          const tblObj = paramsRec?.['table'] ?? paramsRec?.['tableName'] ?? paramsRec?.['name'];
          const tbl = typeof tblObj === "string" ? tblObj : "unknown";
          return withTokenEstimate({
            success: false, error: `Table '${tbl}' does not exist`, code: "TABLE_NOT_FOUND", category: "resource", recoverable: false,
            details: { exists: false, table: tbl },
          });
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
