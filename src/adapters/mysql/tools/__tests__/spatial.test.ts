/**
 * mysql-mcp - Spatial Tools Unit Tests
 *
 * Tests for spatial tool definitions and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSpatialTools } from "../spatial/index.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult } from "../../../../__tests__/mocks/index.js";

describe("getSpatialTools", () => {
  let tools: ReturnType<typeof getSpatialTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getSpatialTools(
      createMockMySQLAdapter(),
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
    tools = getSpatialTools(mockAdapter);
    mockContext = createMockRequestContext();
  });

  describe("mysql_spatial_create_column", () => {
    it("should create a spatial column", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_spatial_create_column");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          table: "locations",
          column: "geom",
          type: "POINT",
          srid: 4326 },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[mockAdapter.executeQuery.mock.calls.length - 1][0];
      expect(call).toContain("ADD COLUMN");
      expect(result).toHaveProperty("success", true);
    });

    it("should create NOT NULL column", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_spatial_create_column");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        {
          table: "locations",
          column: "geom",
          nullable: false },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[mockAdapter.executeQuery.mock.calls.length - 1][0];
      expect(call).toContain("NOT NULL");
    });
  });

  describe("mysql_spatial_create_index", () => {
    it("should create a spatial index", async () => {
      // First call: column info (NOT NULL), second: no existing index, third: CREATE
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ Null: "NO", Type: "point" }]),
        )
        .mockResolvedValueOnce(createMockQueryResult([]))
        .mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_spatial_create_index");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          table: "locations",
          column: "geom",
          indexName: "idx_locations_geom" },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);
      const call = mockAdapter.executeQuery.mock.calls[2][0];
      expect(call).toContain("SPATIAL INDEX");
      expect(result).toHaveProperty("success", true);
    });

    it("should return structured error for nullable columns", async () => {
      // Column is nullable - should return { success: false, error }
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ Null: "YES", Type: "point" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_create_index");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          table: "locations",
          column: "geom",
          indexName: "idx_locations_geom" },
        mockContext,
      );

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining(
          "Cannot create SPATIAL index on nullable column",
        ) });
    });

    it("should return structured error for duplicate index", async () => {
      // First call: column info, second: no existing index, third: fails with duplicate key
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ Null: "NO", Type: "point" }]),
        )
        .mockResolvedValueOnce(createMockQueryResult([]))
        .mockRejectedValueOnce(
          new Error(
            "Query failed: Execute failed: Duplicate key name 'idx_locations_geom'",
          ),
        );

      const tool = tools.find((t) => t.name === "mysql_spatial_create_index");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          table: "locations",
          column: "geom",
          indexName: "idx_locations_geom" },
        mockContext,
      );

      expect(result).toMatchObject({
        success: false,
        error: "Index 'idx_locations_geom' already exists on table 'locations'" });
    });

    it("should handle other index creation errors gracefully", async () => {
      // First call: column info, second: no existing index, third: fails with generic error
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ Null: "NO", Type: "point" }]),
        )
        .mockResolvedValueOnce(createMockQueryResult([]))
        .mockRejectedValueOnce(new Error("Some other MySQL error"));

      const tool = tools.find((t) => t.name === "mysql_spatial_create_index");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          table: "locations",
          column: "geom",
          indexName: "idx_locations_geom" },
        mockContext,
      );

      expect(result).toMatchObject({
        success: false,
        error: "Some other MySQL error" });
    });
  });

  describe("mysql_spatial_point", () => {
    it("should create a POINT geometry", async () => {
      mockAdapter.executeReadQuery.mockResolvedValueOnce(createMockQueryResult([{ DATA_TYPE: "point", SRS_ID: 4326 }])).mockResolvedValue(createMockQueryResult([{ wkt: "POINT(-73.9857 40.7484)", srid: 4326 }]));

      const tool = tools.find((t) => t.name === "mysql_spatial_point");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        { longitude: -73.9857, latitude: 40.7484 },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const args = mockAdapter.executeReadQuery.mock.calls[mockAdapter.executeReadQuery.mock.calls.length - 1][1];
      expect(args[0]).toContain("POINT");
      expect(result).toBeDefined();
    });

    it("should handle invalid coordinates gracefully", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Invalid coordinate"),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_point");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        { longitude: -200, latitude: 40.7484 },
        mockContext,
      );

      expect(result).toMatchObject({
        success: false,
        error: "Validation error: longitude must be between -180 and 180 degrees for SRID 4326" });
    });
  });

  describe("mysql_spatial_polygon", () => {
    it("should create a POLYGON geometry", async () => {
      mockAdapter.executeReadQuery.mockResolvedValueOnce(createMockQueryResult([{ DATA_TYPE: "point", SRS_ID: 4326 }])).mockResolvedValue(createMockQueryResult([{ wkt: "POLYGON((...))" }]));

      const tool = tools.find((t) => t.name === "mysql_spatial_polygon");
      if (!tool) throw new Error('Tool not found');;
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
          srid: 4326 },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("mysql_spatial_distance", () => {
    it("should find points within distance", async () => {
      mockAdapter.executeReadQuery.mockImplementation(async (sql) => {
        if (sql.includes("information_schema.tables")) return createMockQueryResult([{ TABLE_NAME: "test" }]);
        if (sql.includes("information_schema.columns")) return createMockQueryResult([{ DATA_TYPE: "point", SRS_ID: 4326 }]);
        return createMockQueryResult([{ distance: 1000.5 }]);
      });

      const tool = tools.find((t) => t.name === "mysql_spatial_distance");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        {
          table: "locations",
          spatialColumn: "geom",
          point: { longitude: 0, latitude: 0 } },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[mockAdapter.executeReadQuery.mock.calls.length - 1][0];
      expect(call).toContain("ST_Distance");
    });
  });

  describe("mysql_spatial_distance_sphere", () => {
    it("should calculate spherical distance", async () => {
      mockAdapter.executeReadQuery.mockImplementation(async (sql) => {
        if (sql.includes("information_schema.tables")) return createMockQueryResult([{ TABLE_NAME: "test" }]);
        if (sql.includes("information_schema.columns")) return createMockQueryResult([{ DATA_TYPE: "point", SRS_ID: 4326 }]);
        return createMockQueryResult([{ id: 1, distance_meters: 5000 }]);
      });

      const tool = tools.find(
        (t) => t.name === "mysql_spatial_distance_sphere",
      )!;
      await tool.handler(
        {
          table: "locations",
          spatialColumn: "geom",
          point: { longitude: -73.9857, latitude: 40.7484 },
          maxDistance: 10000 },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[mockAdapter.executeReadQuery.mock.calls.length - 1][0];
      expect(call).toContain("ST_Distance_Sphere");
    });
  });

  describe("mysql_spatial_contains", () => {
    it("should find geometries within a polygon", async () => {
      mockAdapter.executeReadQuery.mockImplementation(async (sql) => {
        if (sql.includes("information_schema.tables")) return createMockQueryResult([{ TABLE_NAME: "test" }]);
        if (sql.includes("information_schema.columns")) return createMockQueryResult([{ DATA_TYPE: "point", SRS_ID: 4326 }]);
        return createMockQueryResult([{ id: 1 }, { id: 2 }]);
      });

      const tool = tools.find((t) => t.name === "mysql_spatial_contains");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        {
          table: "locations",
          spatialColumn: "geom",
          polygon: "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))" },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[mockAdapter.executeReadQuery.mock.calls.length - 1][0];
      expect(call).toContain("ST_Contains");
    });
  });

  describe("mysql_spatial_within", () => {
    it("should find geometries within another", async () => {
      mockAdapter.executeReadQuery.mockImplementation(async (sql) => {
        if (sql.includes("information_schema.tables")) return createMockQueryResult([{ TABLE_NAME: "test" }]);
        if (sql.includes("information_schema.columns")) return createMockQueryResult([{ DATA_TYPE: "point", SRS_ID: 4326 }]);
        return createMockQueryResult([{ id: 1 }]);
      });

      const tool = tools.find((t) => t.name === "mysql_spatial_within");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        {
          table: "locations",
          spatialColumn: "geom",
          geometry: "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))" },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[mockAdapter.executeReadQuery.mock.calls.length - 1][0];
      expect(call).toContain("ST_Within");
    });
  });

  describe("mysql_spatial_intersection", () => {
    it("should calculate intersection of geometries", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { intersects: 1, intersection_wkt: "POINT(5 5)" },
        ]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_intersection");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        {
          geometry1: "POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))",
          geometry2: "POLYGON((5 5, 15 5, 15 15, 5 15, 5 5))",
          srid: 0 },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[mockAdapter.executeReadQuery.mock.calls.length - 1][0];
      expect(call).toContain("ST_Intersection");
    });
  });

  describe("mysql_spatial_buffer", () => {
    it("should create buffer around geometry", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ buffered: "POLYGON(...)" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_buffer");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        { geometry: "POINT(0 0)", distance: 100 },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[mockAdapter.executeReadQuery.mock.calls.length - 1][0];
      expect(call).toContain("ST_Buffer");
    });
  });

  describe("mysql_spatial_transform", () => {
    it("should transform geometry between SRIDs", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ transformed_wkt: "POINT(...)" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_transform");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        { geometry: "POINT(0 0)", fromSrid: 4326, toSrid: 3857 },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      
      // Find the actual transform query, as validateSrid might have been called first
      const transformCall = mockAdapter.executeReadQuery.mock.calls.find(c => String(c[0]).includes("ST_Transform"));
      expect(transformCall).toBeDefined();
      const call = transformCall![0];
      
      expect(call).toContain("ST_Transform");
    });
  });

  describe("mysql_spatial_geojson", () => {
    it("should convert WKT to GeoJSON", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { geoJson: '{"type":"Point","coordinates":[0,0]}' },
        ]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_geojson");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        { geometry: "POINT(0 0)" },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should convert GeoJSON to WKT", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ wkt: "POINT(0 0)" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_spatial_geojson");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        { geoJson: '{"type":"Point","coordinates":[0,0]}' },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should catch empty string in Zod validation", async () => {
      const tool = tools.find((t) => t.name === "mysql_spatial_geojson");
      if (!tool) throw new Error('Tool not found');;
      // geometry: "" is now caught by Zod refine
      const result = await tool.handler({ geometry: "" }, mockContext);
      expect(result).toMatchObject({
        success: false,
        error: "Validation error: Provided geometry must be a valid WKT string, or geoJson must be a valid GeoJSON object" });
    });
  });
});
