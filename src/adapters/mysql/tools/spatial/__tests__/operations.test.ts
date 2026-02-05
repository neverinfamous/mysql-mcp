/**
 * mysql-mcp - Spatial Operations Tools Unit Tests
 *
 * Comprehensive tests for operations.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSpatialIntersectionTool,
  createSpatialBufferTool,
  createSpatialTransformTool,
  createSpatialGeoJSONTool,
} from "../operations.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Spatial Operations Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createSpatialIntersectionTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSpatialIntersectionTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_spatial_intersection");
    });

    it("should calculate intersection", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            intersects: 1,
            intersection_wkt: "POINT(5 5)",
            intersection_geojson: '{"type":"Point"}',
          },
        ]),
      );

      const tool = createSpatialIntersectionTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          geometry1: "POLYGON(...)",
          geometry2: "POINT(5 5)",
        },
        mockContext,
      )) as { intersects: boolean; intersectionWkt: string };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result.intersects).toBe(true);
      expect(result.intersectionWkt).toBe("POINT(5 5)");
    });

    it("should handle no intersection", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            intersects: 0,
          },
        ]),
      );

      const tool = createSpatialIntersectionTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          geometry1: "POLYGON(...)",
          geometry2: "POINT(100 100)",
        },
        mockContext,
      )) as { intersects: boolean };

      expect(result.intersects).toBe(false);
    });
  });

  describe("createSpatialBufferTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSpatialBufferTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_spatial_buffer");
    });

    it("should create buffer around geometry", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            buffer_wkt: "POLYGON(...)",
            buffer_geojson: '{"type":"Polygon"}',
          },
        ]),
      );

      const tool = createSpatialBufferTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler(
        {
          geometry: "POINT(0 0)",
          distance: 10,
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toHaveProperty("bufferWkt");
      expect(result).toHaveProperty("bufferGeoJson");
    });
  });

  describe("createSpatialTransformTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSpatialTransformTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_spatial_transform");
    });

    it("should transform geometry between SRIDs", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            transformed_wkt: "POINT(1000 2000)",
            transformed_geojson: '{"type":"Point"}',
          },
        ]),
      );

      const tool = createSpatialTransformTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler(
        {
          geometry: "POINT(10 20)",
          fromSrid: 4326,
          toSrid: 3857,
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("ST_Transform");
      expect(call).toContain("4326");
      expect(call).toContain("3857");
      expect(result).toHaveProperty("transformedWkt");
    });
  });

  describe("createSpatialGeoJSONTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSpatialGeoJSONTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_spatial_geojson");
    });

    it("should convert WKT to GeoJSON", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            geoJson: '{"type":"Point","coordinates":[10,20]}',
          },
        ]),
      );

      const tool = createSpatialGeoJSONTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { geometry: "POINT(10 20)" },
        mockContext,
      )) as { geoJson: any };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result.geoJson).toEqual({ type: "Point", coordinates: [10, 20] });
    });

    it("should convert GeoJSON to WKT", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            wkt: "POINT(10 20)",
          },
        ]),
      );

      const tool = createSpatialGeoJSONTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { geoJson: '{"type":"Point","coordinates":[10,20]}' },
        mockContext,
      )) as { wkt: string };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result.wkt).toBe("POINT(10 20)");
    });

    it("should throw if neither geometry nor geoJson provided", async () => {
      const tool = createSpatialGeoJSONTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      // Use type assertion or casting to bypass TS error for invalid input in test
      // Zod parser will catch it, or refiner.
      // Wait, Zod schema has refine check.
      await expect(tool.handler({}, mockContext)).rejects.toThrow();
    });

    it("should throw if both geometry and geoJson provided", async () => {
      const tool = createSpatialGeoJSONTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await expect(
        tool.handler(
          {
            geometry: "POINT(0 0)",
            geoJson: "{}",
          },
          mockContext,
        ),
      ).rejects.toThrow();
    });
  });
});
