import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSpatialTools } from "../spatial/index.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../__tests__/mocks/index.js";

describe("Spatial Tools Handlers", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;
  let tools: ReturnType<typeof getSpatialTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
    tools = getSpatialTools(mockAdapter as unknown as MySQLAdapter);
  });

  const findTool = (name: string) => tools.find((t) => t.name === name);

  describe("mysql_spatial_create_column", () => {
    it("should validate table and column names", async () => {
      const tool = findTool("mysql_spatial_create_column")!;

      await expect(
        tool.handler(
          {
            table: "invalid table",
            column: "geom",
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid table name");

      await expect(
        tool.handler(
          {
            table: "users",
            column: "invalid-column",
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid column name");
    });

    it("should execute ALTER TABLE with correct types", async () => {
      const tool = findTool("mysql_spatial_create_column")!;
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      await tool.handler(
        {
          table: "users",
          column: "location",
          type: "POINT",
          srid: 4326,
          nullable: false,
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "ALTER TABLE `users` ADD COLUMN `location` POINT SRID 4326 NOT NULL",
        ),
      );
    });
  });

  describe("mysql_spatial_create_index", () => {
    it("should validate identifiers", async () => {
      const tool = findTool("mysql_spatial_create_index")!;

      await expect(
        tool.handler(
          {
            table: "users",
            column: "location",
            indexName: "bad-index",
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid index name");
    });

    it("should generate default index name if not provided", async () => {
      const tool = findTool("mysql_spatial_create_index")!;
      // First call returns column info (NOT NULL), second call is index creation
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ IS_NULLABLE: "NO", DATA_TYPE: "point" }]),
        )
        .mockResolvedValueOnce(createMockQueryResult([]));

      const result = await tool.handler(
        {
          table: "users",
          column: "location",
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      expect(mockAdapter.executeQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          "CREATE SPATIAL INDEX `idx_spatial_users_location`",
        ),
      );
      expect(result).toHaveProperty("indexName", "idx_spatial_users_location");
    });
  });

  describe("mysql_spatial_distance", () => {
    it("should include WHERE clause if maxDistance is provided", async () => {
      const tool = findTool("mysql_spatial_distance")!;
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      await tool.handler(
        {
          table: "places",
          spatialColumn: "geom",
          point: { longitude: 10, latitude: 20 },
          maxDistance: 1000,
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE ST_Distance"),
        expect.arrayContaining([1000]),
      );
    });

    it("should omit WHERE clause if maxDistance is missing", async () => {
      const tool = findTool("mysql_spatial_distance")!;
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      await tool.handler(
        {
          table: "places",
          spatialColumn: "geom",
          point: { longitude: 10, latitude: 20 },
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.not.stringContaining("WHERE ST_Distance"),
        expect.anything(),
      );
    });
  });

  describe("mysql_spatial_geojson", () => {
    it("should convert WKT to GeoJSON", async () => {
      const tool = findTool("mysql_spatial_geojson")!;
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { geoJson: '{"type":"Point","coordinates":[1,1]}' },
        ]),
      );

      const result = await tool.handler(
        {
          geometry: "POINT(1 1)",
        },
        mockContext,
      );

      expect((result as any).conversion).toBe("WKT to GeoJSON");
      expect((result as any).geoJson).toEqual({
        type: "Point",
        coordinates: [1, 1],
      });
    });

    it("should convert GeoJSON to WKT", async () => {
      const tool = findTool("mysql_spatial_geojson")!;
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ wkt: "POINT(1 1)" }]),
      );

      const result = await tool.handler(
        {
          geoJson: '{"type":"Point","coordinates":[1,1]}',
        },
        mockContext,
      );

      expect((result as any).conversion).toBe("GeoJSON to WKT");
      expect((result as any).wkt).toBe("POINT(1 1)");
    });

    it("should throw if both inputs are missing (zod refinement)", async () => {
      const tool = findTool("mysql_spatial_geojson")!;
      // Note: Zod error comes from parse, which happens inside handler but Zod throws it.
      // We can check if it throws "Either geometry or geoJson must be provided"
      // Actually Zod throws ZodError, but our tool catches? No handler doesn't catch.
      await expect(tool.handler({}, mockContext)).rejects.toThrow();
    });
  });

  describe("P154 Graceful Error Handling", () => {
    it("should return { exists: false } for nonexistent table (distance)", async () => {
      const tool = findTool("mysql_spatial_distance")!;
      mockAdapter.executeQuery.mockRejectedValueOnce(
        new Error("Table 'db.nonexistent' doesn't exist"),
      );

      const result = await tool.handler(
        {
          table: "nonexistent",
          spatialColumn: "geom",
          point: { longitude: 10, latitude: 20 },
        },
        mockContext,
      );

      expect(result).toEqual({ exists: false, table: "nonexistent" });
    });

    it("should return { exists: false } for nonexistent table (distance_sphere)", async () => {
      const tool = findTool("mysql_spatial_distance_sphere")!;
      mockAdapter.executeQuery.mockRejectedValueOnce(
        new Error("Table 'db.nonexistent' doesn't exist"),
      );

      const result = await tool.handler(
        {
          table: "nonexistent",
          spatialColumn: "geom",
          point: { longitude: 10, latitude: 20 },
        },
        mockContext,
      );

      expect(result).toEqual({ exists: false, table: "nonexistent" });
    });

    it("should return { exists: false } for nonexistent table (contains)", async () => {
      const tool = findTool("mysql_spatial_contains")!;
      mockAdapter.executeQuery.mockRejectedValueOnce(
        new Error("Table 'db.nonexistent' doesn't exist"),
      );

      const result = await tool.handler(
        {
          table: "nonexistent",
          spatialColumn: "geom",
          polygon: "POLYGON((0 0,1 0,1 1,0 1,0 0))",
        },
        mockContext,
      );

      expect(result).toEqual({ exists: false, table: "nonexistent" });
    });

    it("should return { exists: false } for nonexistent table (within)", async () => {
      const tool = findTool("mysql_spatial_within")!;
      mockAdapter.executeQuery.mockRejectedValueOnce(
        new Error("Table 'db.nonexistent' doesn't exist"),
      );

      const result = await tool.handler(
        {
          table: "nonexistent",
          spatialColumn: "geom",
          geometry: "POLYGON((0 0,1 0,1 1,0 1,0 0))",
        },
        mockContext,
      );

      expect(result).toEqual({ exists: false, table: "nonexistent" });
    });

    it("should return { exists: false } for nonexistent table (create_column)", async () => {
      const tool = findTool("mysql_spatial_create_column")!;
      mockAdapter.executeQuery.mockRejectedValueOnce(
        new Error("Table 'db.nonexistent' doesn't exist"),
      );

      const result = await tool.handler(
        {
          table: "nonexistent",
          column: "geom",
        },
        mockContext,
      );

      expect(result).toEqual({ exists: false, table: "nonexistent" });
    });

    it("should return { exists: false } for nonexistent table (create_index)", async () => {
      const tool = findTool("mysql_spatial_create_index")!;
      mockAdapter.executeQuery.mockRejectedValueOnce(
        new Error("Table 'db.nonexistent' doesn't exist"),
      );

      const result = await tool.handler(
        {
          table: "nonexistent",
          column: "geom",
        },
        mockContext,
      );

      expect(result).toEqual({ exists: false, table: "nonexistent" });
    });

    it("should return { success: false } for MySQL error (distance)", async () => {
      const tool = findTool("mysql_spatial_distance")!;
      mockAdapter.executeQuery.mockRejectedValueOnce(
        new Error("Unknown column 'bad_col' in 'field list'"),
      );

      const result = await tool.handler(
        {
          table: "places",
          spatialColumn: "bad_col",
          point: { longitude: 10, latitude: 20 },
        },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        error: "Unknown column 'bad_col' in 'field list'",
      });
    });

    it("should return { success: false } for invalid WKT (intersection)", async () => {
      const tool = findTool("mysql_spatial_intersection")!;
      mockAdapter.executeQuery.mockRejectedValueOnce(
        new Error("Invalid GIS data"),
      );

      const result = await tool.handler(
        {
          geometry1: "INVALID_WKT",
          geometry2: "POINT(0 0)",
        },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        error: "Invalid GIS data",
      });
    });

    it("should return { success: false } for invalid WKT (buffer)", async () => {
      const tool = findTool("mysql_spatial_buffer")!;
      mockAdapter.executeQuery.mockRejectedValueOnce(
        new Error("Invalid GIS data"),
      );

      const result = await tool.handler(
        {
          geometry: "INVALID_WKT",
          distance: 100,
        },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        error: "Invalid GIS data",
      });
    });

    it("should return { success: false } for invalid SRID (transform)", async () => {
      const tool = findTool("mysql_spatial_transform")!;
      mockAdapter.executeQuery.mockRejectedValueOnce(
        new Error("There's no spatial reference system with SRID 99999"),
      );

      const result = await tool.handler(
        {
          geometry: "POINT(0 0)",
          fromSrid: 4326,
          toSrid: 99999,
        },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        error: "There's no spatial reference system with SRID 99999",
      });
    });

    it("should return { success: false } for invalid WKT (geojson)", async () => {
      const tool = findTool("mysql_spatial_geojson")!;
      mockAdapter.executeQuery.mockRejectedValueOnce(
        new Error("Invalid GIS data"),
      );

      const result = await tool.handler(
        {
          geometry: "INVALID_WKT",
        },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        error: "Invalid GIS data",
      });
    });

    it("should return { success: false } for invalid coordinates (point)", async () => {
      const tool = findTool("mysql_spatial_point")!;
      mockAdapter.executeQuery.mockRejectedValueOnce(
        new Error("Latitude must be in range"),
      );

      const result = await tool.handler(
        {
          longitude: 0,
          latitude: 999,
        },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        error: "Latitude must be in range",
      });
    });

    it("should return { success: false, reason } for duplicate column (create_column)", async () => {
      const tool = findTool("mysql_spatial_create_column")!;
      mockAdapter.executeQuery.mockRejectedValueOnce(
        new Error("Duplicate column name 'location'"),
      );

      const result = await tool.handler(
        {
          table: "users",
          column: "location",
        },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        reason: "Column 'location' already exists on table 'users'",
      });
    });

    it("should include segmentsApplied: false for geographic SRID (buffer)", async () => {
      const tool = findTool("mysql_spatial_buffer")!;
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            buffer_wkt: "POLYGON((0 0,1 0,1 1,0 1,0 0))",
            buffer_geojson:
              '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}',
          },
        ]),
      );

      const result = await tool.handler(
        {
          geometry: "POINT(0 0)",
          distance: 100,
          srid: 4326,
          segments: 4,
        },
        mockContext,
      );

      expect((result as any).segmentsApplied).toBe(false);
      expect((result as any).segments).toBe(4);
    });

    it("should include segmentsApplied: true for Cartesian SRID (buffer)", async () => {
      const tool = findTool("mysql_spatial_buffer")!;
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            buffer_wkt: "POLYGON((0 0,1 0,1 1,0 1,0 0))",
            buffer_geojson:
              '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}',
          },
        ]),
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

      expect((result as any).segmentsApplied).toBe(true);
      expect((result as any).segments).toBe(4);
    });
  });
});
