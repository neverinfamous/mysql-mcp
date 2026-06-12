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
import type {} from "../../../mysql-adapter/index.js";
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
        mockAdapter,
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
        mockAdapter,
      );
      const result = (await tool.handler(
        {
          geometry1: "POLYGON(...)",
          geometry2: "POINT(5 5)",
        },
        mockContext,
      )) as { data: { intersects: boolean; intersectionWkt: string } };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result.data.intersects).toBe(true);
      expect(result.data.intersectionWkt).toBe("POINT(5 5)");
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
        mockAdapter,
      );
      const result = (await tool.handler(
        {
          geometry1: "POLYGON(...)",
          geometry2: "POINT(100 100)",
        },
        mockContext,
      )) as { data: { intersects: boolean } };

      expect(result.data.intersects).toBe(false);
    });
  });

  describe("createSpatialBufferTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSpatialBufferTool(
        mockAdapter,
      );
      expect(tool.name).toBe("mysql_spatial_buffer");
    });

    it("should create buffer around geometry with default segments", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            buffer_wkt: "POLYGON(...)",
            buffer_geojson: '{"type":"Polygon"}',
          },
        ]),
      );

      const tool = createSpatialBufferTool(
        mockAdapter,
      );
      const result = await tool.handler(
        {
          geometry: "POINT(0 0)",
          distance: 10,
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0];
      // Default SRID is 4326 (geographic) — ST_Buffer_Strategy is not used
      expect(call).not.toContain("ST_Buffer_Strategy");
      expect(Reflect.get(result || {}, "data")).toHaveProperty("bufferWkt");
      expect(Reflect.get(result || {}, "data")).toHaveProperty("segments", 8);
    });

    it("should use ST_Buffer_Strategy with Cartesian SRID", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            buffer_wkt: "POLYGON(...)",
            buffer_geojson: '{"type":"Polygon"}',
          },
        ]),
      );

      const tool = createSpatialBufferTool(
        mockAdapter,
      );
      const result = await tool.handler(
        {
          geometry: "POINT(0 0)",
          distance: 100,
          srid: 0,
          segments: 4,
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0];
      expect(call).toContain("ST_Buffer_Strategy('point_circle', 4)");
      expect(Reflect.get(result || {}, "data")).toHaveProperty("segments", 4);
    });
  });

  describe("createSpatialTransformTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSpatialTransformTool(
        mockAdapter,
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
        mockAdapter,
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
      const call = mockAdapter.executeQuery.mock.calls[0][0];
      expect(call).toContain("ST_Transform");
      expect(call).toContain("4326");
      expect(call).toContain("3857");
      expect(Reflect.get(result || {}, "data")).toHaveProperty("transformedWkt");
    });
  });

  describe("createSpatialGeoJSONTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSpatialGeoJSONTool(
        mockAdapter,
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
        mockAdapter,
      );
      const result = (await tool.handler(
        { geometry: "POINT(10 20)" },
        mockContext,
      )) as { data: { geoJson: Record<string, unknown> } };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result.data.geoJson).toEqual({
        type: "Point",
        coordinates: [10, 20],
      });
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
        mockAdapter,
      );
      const result = (await tool.handler(
        { geoJson: '{"type":"Point","coordinates":[10,20]}' },
        mockContext,
      )) as { data: { wkt: string } };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result.data.wkt).toBe("POINT(10 20)");
    });

    it("should return structured error if neither geometry nor geoJson provided", async () => {
      const tool = createSpatialGeoJSONTool(
        mockAdapter,
      );
      const result = await tool.handler({}, mockContext);
      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining(
          "Either geometry or geoJson must be provided",
        ),
      });
    });

    it("should return structured error if both geometry and geoJson provided", async () => {
      const tool = createSpatialGeoJSONTool(
        mockAdapter,
      );
      const result = await tool.handler(
        {
          geometry: "POINT(0 0)",
          geoJson: "{}",
        },
        mockContext,
      );

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining(
          "Either geometry or geoJson must be provided",
        ),
      });
    });
  });
});
