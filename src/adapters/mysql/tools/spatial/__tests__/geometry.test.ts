/**
 * mysql-mcp - Spatial Geometry Tools Unit Tests
 *
 * Comprehensive tests for geometry.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSpatialPointTool,
  createSpatialPolygonTool,
} from "../geometry.js";
import type {} from "../../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Spatial Geometry Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createSpatialPointTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSpatialPointTool(
        mockAdapter,
      );
      expect(tool.name).toBe("mysql_spatial_point");
      expect(tool.group).toBe("spatial");
    });

    it("should create point from coordinates", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            wkt: "POINT(20 10)",
            geoJson: '{"type":"Point","coordinates":[10,20]}',
          },
        ]),
      );

      const tool = createSpatialPointTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { longitude: 10, latitude: 20 },
        mockContext,
      )) as { data: { wkt: string; geoJson: any } };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0];
      // With axis-order=long-lat, longitude comes first in POINT
      expect(call).toContain("POINT(10 20)");
      expect(call).toContain("axis-order=long-lat");
      expect(result.data.wkt).toBe("POINT(20 10)");
      expect(result.data.geoJson).toEqual({
        type: "Point",
        coordinates: [10, 20],
      });
    });

    it("should use default SRID 4326", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSpatialPointTool(
        mockAdapter,
      );
      await tool.handler({ longitude: 10, latitude: 20 }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0];
      expect(call).toContain("4326");
    });

    it("should handle custom SRID", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSpatialPointTool(
        mockAdapter,
      );
      await tool.handler(
        { longitude: 10, latitude: 20, srid: 3857 },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0];
      expect(call).toContain("3857");
    });
  });

  describe("createSpatialPolygonTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSpatialPolygonTool(
        mockAdapter,
      );
      expect(tool.name).toBe("mysql_spatial_polygon");
    });

    it("should create polygon from coordinates", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            wkt: "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))",
            geoJson: '{"type":"Polygon"}',
            area: 100,
          },
        ]),
      );

      const tool = createSpatialPolygonTool(
        mockAdapter,
      );
      const coordinates = [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
      ] as [number, number][][];

      const result = (await tool.handler({ coordinates }, mockContext)) as {
        data: { wkt: string; area: number };
      };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0];
      // Now using axis-order=long-lat for correct coordinate handling
      expect(call).toContain("axis-order=long-lat");
      const args = mockAdapter.executeQuery.mock.calls[0][1];
      expect(args[0]).toBe("POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))");

      expect(result.data.wkt).toBe("POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))");
      expect(result.data.area).toBe(100);
    });
  });
});
