import { describe, it, expect, vi } from "vitest";
import { createSpatialDistanceTool } from "./src/adapters/mysql/tools/spatial/queries.ts";
import { createMockQueryResult } from "./src/__tests__/mocks/adapter.ts";

const mockAdapter = {
  executeReadQuery: vi.fn(),
  executeWriteQuery: vi.fn(),
  executeQuery: vi.fn(),
  rawQuery: vi.fn(),
} as any;

const mockContext = {} as any;

async function run() {
  mockAdapter.executeReadQuery.mockImplementation(async (sql) => {
    console.log("MOCK CALLED WITH:", sql);
    if (sql.includes("information_schema.columns")) return createMockQueryResult([{ DATA_TYPE: "geometry", SRS_ID: 0 }]);
    return createMockQueryResult([{ id: 1, distance: 100 }]);
  });

  const tool = createSpatialDistanceTool(mockAdapter as any);
  console.log("Executing tool...");
  const result = await tool.handler(
    {
      point: { longitude: 0, latitude: 0 },
      spatialColumn: "geom",
      table: "test",
    },
    mockContext
  );
  console.log("TOOL RESULT:", JSON.stringify(result, null, 2));
  console.log("MOCK CALLS:", mockAdapter.executeReadQuery.mock.calls);
}

run().catch(console.error);
