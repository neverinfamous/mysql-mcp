import { describe, it, expect } from "vitest";
import { createOAuthResourceServer, createTokenValidator } from "../auth.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { McpServerConfig } from "../../../types/index.js";

describe("auth", () => {
  describe("createOAuthResourceServer", () => {
    it("should throw if oauth is not enabled", () => {
      const config: McpServerConfig = { oauth: { enabled: false } } as any;
      expect(() => createOAuthResourceServer(config)).toThrow(McpError);
      expect(() => createOAuthResourceServer(config)).toThrow("OAuth is not enabled");
    });

    it("should throw if issuer is missing", () => {
      const config: McpServerConfig = { oauth: { enabled: true, audience: "test" } } as any;
      expect(() => createOAuthResourceServer(config)).toThrow(McpError);
      expect(() => createOAuthResourceServer(config)).toThrow("OAuth issuer is required");
    });

    it("should create OAuthResourceServer with correct config", () => {
      const config: McpServerConfig = {
        oauth: { enabled: true, issuer: "https://example.com", audience: "mysql-mcp" }
      } as any;
      const server = createOAuthResourceServer(config);
      expect(server).toBeDefined();
    });
  });

  describe("createTokenValidator", () => {
    it("should throw if oauth is not enabled", () => {
      const config: McpServerConfig = { oauth: { enabled: false } } as any;
      expect(() => createTokenValidator(config)).toThrow(McpError);
      expect(() => createTokenValidator(config)).toThrow("OAuth is not enabled");
    });

    it("should throw if jwksUri is missing", () => {
      const config: McpServerConfig = { oauth: { enabled: true } } as any;
      expect(() => createTokenValidator(config)).toThrow(McpError);
      expect(() => createTokenValidator(config)).toThrow("OAuth JWKS URI is required");
    });

    it("should throw if issuer or audience is missing", () => {
      const config1: McpServerConfig = {
        oauth: { enabled: true, jwksUri: "https://example.com/jwks", audience: "test" }
      } as any;
      expect(() => createTokenValidator(config1)).toThrow(McpError);
      expect(() => createTokenValidator(config1)).toThrow("OAuth issuer and audience are required");

      const config2: McpServerConfig = {
        oauth: { enabled: true, jwksUri: "https://example.com/jwks", issuer: "https://example.com" }
      } as any;
      expect(() => createTokenValidator(config2)).toThrow(McpError);
    });

    it("should create TokenValidator with correct config", () => {
      const config: McpServerConfig = {
        oauth: {
          enabled: true,
          jwksUri: "https://example.com/jwks",
          issuer: "https://example.com",
          audience: "mysql-mcp"
        }
      } as any;
      const validator = createTokenValidator(config);
      expect(validator).toBeDefined();
    });
  });
});
