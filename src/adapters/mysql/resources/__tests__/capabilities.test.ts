import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCapabilitiesResource } from "../capabilities.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../__tests__/mocks/index.js";

interface CapabilitiesResult {
  server: {
    version: string;
    features: {
      json: boolean;
      fulltext: boolean;
      partitioning: boolean;
      replication: boolean;
      gtid: boolean;
    };
  };
  toolGroups: unknown[];
  metaGroups: unknown[];
}

describe("Capabilities Resource", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  it("should return server capabilities", async () => {
    mockAdapter.executeQuery.mockResolvedValue(
      createMockQueryResult([{ version: "8.0.35" }]),
    );

    const resource = createCapabilitiesResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://capabilities",
      mockContext,
    )) as CapabilitiesResult;

    expect(result).toHaveProperty("server");
    expect(result.server).toHaveProperty("version");
    expect(result).toHaveProperty("toolGroups");
    expect(result).toHaveProperty("metaGroups");
  });

  it("should include server features", async () => {
    mockAdapter.executeQuery.mockResolvedValue(
      createMockQueryResult([{ version: "8.0.35" }]),
    );

    const resource = createCapabilitiesResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://capabilities",
      mockContext,
    )) as CapabilitiesResult;

    expect(result.server).toHaveProperty("features");
    expect(result.server.features).toHaveProperty("json");
    expect(result.server.features).toHaveProperty("fulltext");
    expect(result.server.features).toHaveProperty("partitioning");
  });

  it("should detect features correctly for MySQL 9.x", async () => {
    mockAdapter.executeQuery.mockResolvedValue(
      createMockQueryResult([{ version: "9.6.0" }]),
    );

    const resource = createCapabilitiesResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://capabilities",
      mockContext,
    )) as CapabilitiesResult;

    expect(result.server.version).toBe("9.6.0");
    expect(result.server.features.json).toBe(true);
    expect(result.server.features.gtid).toBe(true);
    expect(result.server.features.fulltext).toBe(true);
    expect(result.server.features.replication).toBe(true);
    expect(result.server.features.partitioning).toBe(true);
  });

  it("should disable version-dependent features for unknown version", async () => {
    mockAdapter.executeQuery.mockResolvedValue(
      createMockQueryResult([{ version: "unknown" }]),
    );

    const resource = createCapabilitiesResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://capabilities",
      mockContext,
    )) as CapabilitiesResult;

    expect(result.server.version).toBe("unknown");
    expect(result.server.features.json).toBe(false);
    expect(result.server.features.gtid).toBe(false);
    // Always-true features remain true
    expect(result.server.features.fulltext).toBe(true);
    expect(result.server.features.replication).toBe(true);
    expect(result.server.features.partitioning).toBe(true);
  });

  it("should have correct metadata", () => {
    const resource = createCapabilitiesResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    expect(resource.uri).toBe("mysql://capabilities");
    expect(resource.mimeType).toBe("application/json");
  });
});
