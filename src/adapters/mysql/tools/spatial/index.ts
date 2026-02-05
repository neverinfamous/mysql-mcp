/**
 * MySQL Spatial/GIS Tools
 *
 * Tools for geospatial data operations in MySQL 8.0+.
 * 12 tools total (2 setup + 2 geometry + 4 queries + 4 operations).
 */

import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type { ToolDefinition } from "../../../../types/index.js";

// Import from submodules
import {
  createSpatialCreateColumnTool,
  createSpatialCreateIndexTool,
} from "./setup.js";

import {
  createSpatialPointTool,
  createSpatialPolygonTool,
} from "./geometry.js";

import {
  createSpatialDistanceTool,
  createSpatialDistanceSphereTool,
  createSpatialContainsTool,
  createSpatialWithinTool,
} from "./queries.js";

import {
  createSpatialIntersectionTool,
  createSpatialBufferTool,
  createSpatialTransformTool,
  createSpatialGeoJSONTool,
} from "./operations.js";

/**
 * Get all spatial tools
 */
export function getSpatialTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createSpatialCreateColumnTool(adapter),
    createSpatialCreateIndexTool(adapter),
    createSpatialPointTool(adapter),
    createSpatialPolygonTool(adapter),
    createSpatialDistanceTool(adapter),
    createSpatialDistanceSphereTool(adapter),
    createSpatialContainsTool(adapter),
    createSpatialWithinTool(adapter),
    createSpatialIntersectionTool(adapter),
    createSpatialBufferTool(adapter),
    createSpatialTransformTool(adapter),
    createSpatialGeoJSONTool(adapter),
  ];
}
