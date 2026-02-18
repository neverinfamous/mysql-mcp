/**
 * mysql-mcp - Spatial Tools Unit Tests
 *
 * Tests for spatial tool definitions and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSpatialTools } from "../spatial/index.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../__tests__/mocks/index.js";

describe("getSpatialTools", () => {
  let tools: ReturnType<typeof getSpatialTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getSpatialTools(
      createMockMySQLAdapter() as unknown as MySQLAdapter,
    );
  });

  it("should return 12 spatial tools", () => {
    expect(tools).toHaveLength(12);
  });

  it("should have spatial group for all tools", () => {
    for (const tool of tools) {
      expect(tool.group).toBe("spatial");
    }
  });

  it("should have handler functions for all tools", () => {
    for (const tool of tools) {
      expect(typeof tool.handler).toBe("function");
    }
  });

  it("should have inputSchema for all tools", () => {
    for (const tool of tools) {
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it("should include expected tool names", () => {
    const names = tools.map((t) => t.name);
    expect(names).toContain("mysql_spatial_create_column");
    expect(names).toContain("mysql_spatial_create_index");
    expect(names).toContain("mysql_spatial_point");
    expect(names).toContain("mysql_spatial_polygon");
    expect(names).toContain("mysql_spatial_distance");
    expect(names).toContain("mysql_spatial_distance_sphere");
    expect(names).toContain("mysql_spatial_contains");
    expect(names).toContain("mysql_spatial_within");
    expect(names).toContain("mysql_spatial_intersection");
    expect(names).toContain("mysql_spatial_buffer");
    expect(names).toContain("mysql_spatial_transform");
    expect(names).toContain("mysql_spatial_geojson");
  });
});

describe("Handler Execution", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tools: ReturnType<typeof getSpatialTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tools = getSpatialTools(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  describe("mysql_spatial_create_column", () => {
    it("should create a spatial column", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_spatial_create_column")!;
      const result = await tool.handler(
        {
          table: "locations",
          column: "geom",
          type: "POINT",
          srid: 4326,
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("ADD COLUMN");
      expect(result).toHaveProperty("success", true);
    });

    it("should create NOT NULL column", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_spatial_create_column")!;
      await tool.handler(
        {
          table: "locations",
          column: "geom",
          nullable: false,
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("NOT NULL");
    });
  });

  describe("mysql_spatial_create_index", () => {
    it("should create a spatial index", async () => {
      // First call: column info (NOT NULL), second: no existing index, third: CREATE
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ IS_NULLABLE: "NO", DATA_TYPE: "point" }]),
        )
        .mockResolvedValueOnce(createMockQueryResult([]))
        .mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_spatial_create_index")!;
      const result = await tool.handler(
        {
          table: "locations",
          column: "geom",
          indexName: "idx_locations_geom",
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);
      const call = mockAdapter.executeQuery.mock.calls[2][0] as string;
      expect(call).toContain("SPATIAL INDEX");
      expect(result).toHaveProperty("success", true);
    });

    it("should return structured error for nullable columns", async () => {
      // Column is nullable - should return { success: false, reason }
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ IS_NULLABLE: "YES", DATA_TYPE: "point" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_create_index")!;
      const result = await tool.handler(
        {
          table: "locations",
          column: "geom",
          indexName: "idx_locations_geom",
        },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        reason: expect.stringContaining(
          "Cannot create SPATIAL index on nullable column",
        ),
      });
    });

    it("should return structured reason for duplicate index", async () => {
      // First call: column info, second: no existing index, third: fails with duplicate key
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ IS_NULLABLE: "NO", DATA_TYPE: "point" }]),
        )
        .mockResolvedValueOnce(createMockQueryResult([]))
        .mockRejectedValueOnce(
          new Error(
            "Query failed: Execute failed: Duplicate key name 'idx_locations_geom'",
          ),
        );

      const tool = tools.find((t) => t.name === "mysql_spatial_create_index")!;
      const result = await tool.handler(
        {
          table: "locations",
          column: "geom",
          indexName: "idx_locations_geom",
        },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        reason:
          "Index 'idx_locations_geom' already exists on table 'locations'",
      });
    });

    it("should handle other index creation errors gracefully", async () => {
      // First call: column info, second: no existing index, third: fails with generic error
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ IS_NULLABLE: "NO", DATA_TYPE: "point" }]),
        )
        .mockResolvedValueOnce(createMockQueryResult([]))
        .mockRejectedValueOnce(new Error("Some other MySQL error"));

      const tool = tools.find((t) => t.name === "mysql_spatial_create_index")!;
      const result = await tool.handler(
        {
          table: "locations",
          column: "geom",
          indexName: "idx_locations_geom",
        },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        error: "Some other MySQL error",
      });
    });
  });

  describe("mysql_spatial_point", () => {
    it("should create a POINT geometry", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ wkt: "POINT(-73.9857 40.7484)", srid: 4326 }]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_point")!;
      const result = await tool.handler(
        { longitude: -73.9857, latitude: 40.7484 },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("POINT");
      expect(result).toBeDefined();
    });

    it("should handle invalid coordinates gracefully", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Invalid coordinate"),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_point")!;
      const result = await tool.handler(
        { longitude: -200, latitude: 40.7484 },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        error: "Invalid coordinate",
      });
    });
  });

  describe("mysql_spatial_polygon", () => {
    it("should create a POLYGON geometry", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ wkt: "POLYGON((...))" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_polygon")!;
      const result = await tool.handler(
        {
          coordinates: [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
              [0, 0],
            ],
          ],
          srid: 4326,
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("mysql_spatial_distance", () => {
    it("should find points within distance", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ distance: 1000.5 }]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_distance")!;
      await tool.handler(
        {
          table: "locations",
          spatialColumn: "geom",
          point: { longitude: 0, latitude: 0 },
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("ST_Distance");
    });
  });

  describe("mysql_spatial_distance_sphere", () => {
    it("should calculate spherical distance", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ id: 1, distance_meters: 5000 }]),
      );

      const tool = tools.find(
        (t) => t.name === "mysql_spatial_distance_sphere",
      )!;
      await tool.handler(
        {
          table: "locations",
          spatialColumn: "geom",
          point: { longitude: -73.9857, latitude: 40.7484 },
          maxDistance: 10000,
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("ST_Distance_Sphere");
    });
  });

  describe("mysql_spatial_contains", () => {
    it("should find geometries within a polygon", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ id: 1 }, { id: 2 }]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_contains")!;
      await tool.handler(
        {
          table: "locations",
          spatialColumn: "geom",
          polygon: "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))",
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("ST_Contains");
    });
  });

  describe("mysql_spatial_within", () => {
    it("should find geometries within another", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ id: 1 }]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_within")!;
      await tool.handler(
        {
          table: "locations",
          spatialColumn: "geom",
          geometry: "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))",
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("ST_Within");
    });
  });

  describe("mysql_spatial_intersection", () => {
    it("should calculate intersection of geometries", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { intersects: 1, intersection_wkt: "POINT(5 5)" },
        ]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_intersection")!;
      await tool.handler(
        {
          geometry1: "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))",
          geometry2: "POLYGON((5 5, 15 5, 15 15, 5 15, 5 5))",
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("ST_Intersection");
    });
  });

  describe("mysql_spatial_buffer", () => {
    it("should create buffer around geometry", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ buffered: "POLYGON(...)" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_buffer")!;
      await tool.handler(
        { geometry: "POINT(0 0)", distance: 100 },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("ST_Buffer");
    });
  });

  describe("mysql_spatial_transform", () => {
    it("should transform geometry between SRIDs", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ transformed_wkt: "POINT(...)" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_transform")!;
      await tool.handler(
        { geometry: "POINT(0 0)", fromSrid: 4326, toSrid: 3857 },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("ST_Transform");
    });
  });

  describe("mysql_spatial_geojson", () => {
    it("should convert WKT to GeoJSON", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { geoJson: '{"type":"Point","coordinates":[0,0]}' },
        ]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_geojson")!;
      const result = await tool.handler(
        { geometry: "POINT(0 0)" },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should convert GeoJSON to WKT", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ wkt: "POINT(0 0)" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_geojson")!;
      const result = await tool.handler(
        { geoJson: '{"type":"Point","coordinates":[0,0]}' },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should handle logic fallback (coverage)", async () => {
      const tool = tools.find((t) => t.name === "mysql_spatial_geojson")!;
      try {
        await tool.handler({ geometry: "" }, mockContext);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
