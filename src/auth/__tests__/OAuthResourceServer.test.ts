/**
 * mysql-mcp - OAuth Resource Server Unit Tests
 *
 * Tests for OAuthResourceServer RFC 9728 compliance including
 * metadata generation, scope validation, and configuration.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  OAuthResourceServer,
  createOAuthResourceServer,
} from "../OAuthResourceServer.js";
import type { ResourceServerConfig } from "../types.js";

describe("OAuthResourceServer", () => {
  let config: ResourceServerConfig;
  let server: OAuthResourceServer;

  beforeEach(() => {
    config = {
      resource: "https://mysql-mcp.example.com",
      authorizationServers: ["https://auth.example.com"],
      scopesSupported: ["read", "write", "admin"],
    };
    server = new OAuthResourceServer(config);
  });

  describe("Construction", () => {
    it("should create server with config", () => {
      expect(server).toBeInstanceOf(OAuthResourceServer);
    });

    it("should set default bearer methods when not provided", () => {
      const metadata = server.getMetadata();
      expect(metadata.bearer_methods_supported).toEqual(["header"]);
    });

    it("should use provided bearer methods", () => {
      const customServer = new OAuthResourceServer({
        ...config,
        bearerMethodsSupported: ["header", "body"],
      });
      const metadata = customServer.getMetadata();
      expect(metadata.bearer_methods_supported).toEqual(["header", "body"]);
    });
  });

  describe("getMetadata()", () => {
    it("should return RFC 9728 compliant structure", () => {
      const metadata = server.getMetadata();

      expect(metadata).toHaveProperty("resource");
      expect(metadata).toHaveProperty("authorization_servers");
      expect(metadata).toHaveProperty("scopes_supported");
      expect(metadata).toHaveProperty("bearer_methods_supported");
      expect(metadata).toHaveProperty("resource_documentation");
      expect(metadata).toHaveProperty("resource_signing_alg_values_supported");
    });

    it("should include correct resource identifier", () => {
      const metadata = server.getMetadata();
      expect(metadata.resource).toBe("https://mysql-mcp.example.com");
    });

    it("should include authorization servers", () => {
      const metadata = server.getMetadata();
      expect(metadata.authorization_servers).toEqual([
        "https://auth.example.com",
      ]);
    });

    it("should include supported scopes", () => {
      const metadata = server.getMetadata();
      expect(metadata.scopes_supported).toEqual(["read", "write", "admin"]);
    });

    it("should generate documentation URL", () => {
      const metadata = server.getMetadata();
      expect(metadata.resource_documentation).toBe(
        "https://mysql-mcp.example.com/docs",
      );
    });

    it("should include signing algorithms", () => {
      const metadata = server.getMetadata();
      expect(metadata.resource_signing_alg_values_supported).toContain("RS256");
      expect(metadata.resource_signing_alg_values_supported).toContain("ES256");
    });
  });

  describe("getWellKnownPath()", () => {
    it("should return correct well-known path", () => {
      expect(server.getWellKnownPath()).toBe(
        "/.well-known/oauth-protected-resource",
      );
    });
  });

  describe("isScopeSupported()", () => {
    it("should return true for explicitly supported scopes", () => {
      expect(server.isScopeSupported("read")).toBe(true);
      expect(server.isScopeSupported("write")).toBe(true);
      expect(server.isScopeSupported("admin")).toBe(true);
    });

    it("should return false for unsupported scopes", () => {
      expect(server.isScopeSupported("delete")).toBe(false);
      expect(server.isScopeSupported("unknown")).toBe(false);
    });

    it("should accept db: prefixed scopes", () => {
      expect(server.isScopeSupported("db:mydb")).toBe(true);
      expect(server.isScopeSupported("db:testdb:read")).toBe(true);
    });

    it("should accept table: prefixed scopes", () => {
      expect(server.isScopeSupported("table:users")).toBe(true);
      expect(server.isScopeSupported("table:orders:write")).toBe(true);
    });

    it("should reject invalid scope patterns", () => {
      expect(server.isScopeSupported("database:mydb")).toBe(false);
      expect(server.isScopeSupported("TB:users")).toBe(false);
    });
  });

  describe("getResourceId()", () => {
    it("should return resource identifier", () => {
      expect(server.getResourceId()).toBe("https://mysql-mcp.example.com");
    });
  });

  describe("getSupportedScopes()", () => {
    it("should return copy of scopes array", () => {
      const scopes = server.getSupportedScopes();
      expect(scopes).toEqual(["read", "write", "admin"]);

      // Verify it's a copy
      scopes.push("modified");
      expect(server.getSupportedScopes()).toEqual(["read", "write", "admin"]);
    });
  });

  describe("getAuthorizationServers()", () => {
    it("should return copy of authorization servers", () => {
      const servers = server.getAuthorizationServers();
      expect(servers).toEqual(["https://auth.example.com"]);

      // Verify it's a copy
      servers.push("https://auth2.example.com");
      expect(server.getAuthorizationServers()).toEqual([
        "https://auth.example.com",
      ]);
    });

    it("should support multiple authorization servers", () => {
      const multiServer = new OAuthResourceServer({
        ...config,
        authorizationServers: [
          "https://auth1.example.com",
          "https://auth2.example.com",
        ],
      });

      expect(multiServer.getAuthorizationServers()).toEqual([
        "https://auth1.example.com",
        "https://auth2.example.com",
      ]);
    });
  });
});

describe("createOAuthResourceServer()", () => {
  it("should create OAuthResourceServer instance", () => {
    const server = createOAuthResourceServer({
      resource: "https://test.example.com",
      authorizationServers: ["https://auth.example.com"],
      scopesSupported: ["read"],
    });

    expect(server).toBeInstanceOf(OAuthResourceServer);
  });

  it("should pass config to server", () => {
    const server = createOAuthResourceServer({
      resource: "https://custom.example.com",
      authorizationServers: ["https://auth.example.com"],
      scopesSupported: ["custom-scope"],
    });

    expect(server.getResourceId()).toBe("https://custom.example.com");
    expect(server.getSupportedScopes()).toContain("custom-scope");
  });
});
