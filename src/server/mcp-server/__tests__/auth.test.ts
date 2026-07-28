import { describe, it, expect } from "vitest";
import { createOAuthResourceServer, createTokenValidator } from "../auth.js";
import { ProtocolError } from "@modelcontextprotocol/server";
import type { McpServerConfig } from "../../../types/index.js";

describe("auth", () => {
  describe("createOAuthResourceServer", () => {
    it("should throw if oauth is not enabled", () => {
      const config: McpServerConfig = { oauth: { enabled: false } } as Record<string, unknown>;
      expect(() => createOAuthResourceServer(config)).toThrow(ProtocolError);
      expect(() => createOAuthResourceServer(config)).toThrow("OAuth is not enabled");
    });

    it("should throw if issuer is missing", () => {
      const config: McpServerConfig = { oauth: { enabled: true, audience: "test" } } as Record<string, unknown>;
      expect(() => createOAuthResourceServer(config)).toThrow(ProtocolError);
      expect(() => createOAuthResourceServer(config)).toThrow("OAuth issuer is required");
    });

    it("should create OAuthResourceServer with correct config", () => {
      const config: McpServerConfig = {
        oauth: { enabled: true, issuer: "https://example.com", audience: "mysql-mcp" }
      } as Record<string, unknown>;
      const server = createOAuthResourceServer(config);
      expect(server).toBeDefined();
    });
  });

  describe("createTokenValidator", () => {
    it("should throw if oauth is not enabled", () => {
      const config: McpServerConfig = { oauth: { enabled: false } } as Record<string, unknown>;
      expect(() => createTokenValidator(config)).toThrow(ProtocolError);
      expect(() => createTokenValidator(config)).toThrow("OAuth is not enabled");
    });

    it("should throw if jwksUri is missing", () => {
      const config: McpServerConfig = { oauth: { enabled: true } } as Record<string, unknown>;
      expect(() => createTokenValidator(config)).toThrow(ProtocolError);
      expect(() => createTokenValidator(config)).toThrow("OAuth JWKS URI is required");
    });

    it("should throw if issuer or audience is missing", () => {
      const config1: McpServerConfig = {
        oauth: { enabled: true, jwksUri: "https://example.com/jwks", audience: "test" }
      } as Record<string, unknown>;
      expect(() => createTokenValidator(config1)).toThrow(ProtocolError);
      expect(() => createTokenValidator(config1)).toThrow("OAuth issuer and audience are required");

      const config2: McpServerConfig = {
        oauth: { enabled: true, jwksUri: "https://example.com/jwks", issuer: "https://example.com" }
      } as Record<string, unknown>;
      expect(() => createTokenValidator(config2)).toThrow(ProtocolError);
    });

    it("should create TokenValidator with correct config", () => {
      const config: McpServerConfig = {
        oauth: {
          enabled: true,
          jwksUri: "https://example.com/jwks",
          issuer: "https://example.com",
          audience: "mysql-mcp"
        }
      } as Record<string, unknown>;
      const validator = createTokenValidator(config);
      expect(validator).toBeDefined();
    });
  });
});
