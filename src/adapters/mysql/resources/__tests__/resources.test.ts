/**
 * mysql-mcp - Resources Unit Tests
 *
 * Tests for resource definitions using centralized mocks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMySQLResources } from "../index.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../__tests__/mocks/index.js";

describe("getMySQLResources", () => {
  let resources: ReturnType<typeof getMySQLResources>;

  beforeEach(() => {
    vi.clearAllMocks();
    resources = getMySQLResources(
      createMockMySQLAdapter() as unknown as MySQLAdapter,
    );
  });

  it("should return 18 resources", () => {
    expect(resources).toHaveLength(18);
  });

  it("should have handler functions for all resources", () => {
    for (const resource of resources) {
      expect(typeof resource.handler).toBe("function");
    }
  });

  it("should have descriptions for all resources", () => {
    for (const resource of resources) {
      expect(resource.description).toBeDefined();
      expect(resource.description.length).toBeGreaterThan(0);
    }
  });

  it("should have unique URIs for all resources", () => {
    const uris = resources.map((r) => r.uri);
    const uniqueUris = new Set(uris);
    expect(uniqueUris.size).toBe(uris.length);
  });

  it("should have URIs starting with mysql://", () => {
    for (const resource of resources) {
      expect(resource.uri.startsWith("mysql://")).toBe(true);
    }
  });
});

describe("Resource Handler Smoke Tests", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;
  let resources: ReturnType<typeof getMySQLResources>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
    resources = getMySQLResources(mockAdapter as unknown as MySQLAdapter);
  });

  const findResource = (uri: string) => resources.find((r) => r.uri === uri);

  it("mysql://tables handler should call listTables", async () => {
    const resource = findResource("mysql://tables");
    expect(resource).toBeDefined();

    const result = await resource!.handler("mysql://tables", mockContext);
    expect(mockAdapter.listTables).toHaveBeenCalled();
    expect(result).toHaveProperty("tables");
  });

  it("mysql://schema handler should call getSchema", async () => {
    const resource = findResource("mysql://schema");
    expect(resource).toBeDefined();

    const result = await resource!.handler("mysql://schema", mockContext);
    expect(mockAdapter.getSchema).toHaveBeenCalled();
    expect(result).toHaveProperty("tables");
  });

  it("mysql://variables handler should execute query", async () => {
    mockAdapter.executeQuery.mockResolvedValue(
      createMockQueryResult([{ Variable_name: "version", Value: "8.0.35" }]),
    );

    const resource = findResource("mysql://variables");
    expect(resource).toBeDefined();

    await resource!.handler("mysql://variables", mockContext);
    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("SHOW"),
    );
  });

  it("mysql://status handler should execute query", async () => {
    mockAdapter.executeQuery.mockResolvedValue(
      createMockQueryResult([{ Variable_name: "Uptime", Value: "86400" }]),
    );

    const resource = findResource("mysql://status");
    expect(resource).toBeDefined();

    await resource!.handler("mysql://status", mockContext);
    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("SHOW"),
    );
  });

  it("mysql://processlist handler should execute processlist query", async () => {
    mockAdapter.executeQuery.mockResolvedValue(
      createMockQueryResult([{ Id: 1, User: "root", Command: "Query" }]),
    );

    const resource = findResource("mysql://processlist");
    expect(resource).toBeDefined();

    await resource!.handler("mysql://processlist", mockContext);
    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("PROCESSLIST"),
    );
  });
});
