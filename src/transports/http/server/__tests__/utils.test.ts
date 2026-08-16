import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ServerResponse } from "node:http";
import type { AuthenticatedContext } from "../../../../auth/middleware.js";
import { isPublicPath, checkToolScope } from "../utils.js";
import { getRequiredScope } from "../../../../auth/scope-map.js";
import { hasScope } from "../../../../auth/scopes.js";

import { logger } from "../../../../utils/logger.js";
import { formatOAuthError } from "../../../../auth/middleware.js";

// Mock dependencies
vi.mock("../../../../auth/scope-map.js", () => ({
  getRequiredScope: vi.fn(),
}));

vi.mock("../../../../auth/scopes.js", () => ({
  hasScope: vi.fn(),
}));

vi.mock("../../../../utils/logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock("../../../../auth/middleware.js", () => ({
  formatOAuthError: vi.fn(),
}));

vi.mock("../../../../auth/errors.js", () => ({
  InsufficientScopeError: class extends Error {
    scopes: string[];
    constructor(scopes: string[]) {
      super("Insufficient scope");
      this.scopes = scopes;
      this.name = "InsufficientScopeError";
    }
  },
}));

describe("HTTP Server Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isPublicPath", () => {
    it("should return false when publicPaths is empty", () => {
      expect(isPublicPath("/api/test")).toBe(false);
    });

    it("should return true for an exact match", () => {
      expect(isPublicPath("/api/test", ["/api/test", "/other"])).toBe(true);
    });

    it("should return false for a non-match", () => {
      expect(isPublicPath("/api/test", ["/api/other"])).toBe(false);
    });

    it("should return true for a wildcard prefix match", () => {
      expect(isPublicPath("/api/auth/login", ["/api/auth/*"])).toBe(true);
      expect(isPublicPath("/api/auth/", ["/api/auth/*"])).toBe(true);
    });

    it("should return false for a wildcard prefix non-match", () => {
      expect(isPublicPath("/api/other/login", ["/api/auth/*"])).toBe(false);
    });
  });

  describe("checkToolScope", () => {
    let mockRes: ServerResponse;
    let authContext: AuthenticatedContext;

    beforeEach(() => {
      mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      authContext = {
        scopes: ["user"],
        clientId: "test-client",
      } as AuthenticatedContext;
    });

    it("should return true if body is not a tool call", () => {
      const body = { method: "other/method" };
      expect(checkToolScope(body, authContext, mockRes)).toBe(true);
    });

    it("should return true if body is a tool call but missing tool name", () => {
      const body = { method: "tools/call", params: {} };
      expect(checkToolScope(body, authContext, mockRes)).toBe(true);
    });

    it("should return true if user has required scope", () => {
      const body = { method: "tools/call", params: { name: "test-tool" } };
      vi.mocked(getRequiredScope).mockReturnValue("required:scope");
      vi.mocked(hasScope).mockReturnValue(true);

      const result = checkToolScope(body, authContext, mockRes);

      expect(result).toBe(true);
      expect(getRequiredScope).toHaveBeenCalledWith("test-tool");
      expect(hasScope).toHaveBeenCalledWith(["user"], "required:scope");
      expect(mockRes.writeHead).not.toHaveBeenCalled();
    });

    it("should return false, write error to response, and log warning if user lacks required scope", () => {
      const body = { method: "tools/call", params: { name: "forbidden-tool" } };
      vi.mocked(getRequiredScope).mockReturnValue("admin:scope");
      vi.mocked(hasScope).mockReturnValue(false);
      vi.mocked(formatOAuthError).mockReturnValue({
        status: 403,
        body: { error: "insufficient_scope" },
      });

      const result = checkToolScope(body, authContext, mockRes);

      expect(result).toBe(false);
      expect(getRequiredScope).toHaveBeenCalledWith("forbidden-tool");
      expect(hasScope).toHaveBeenCalledWith(["user"], "admin:scope");
      
      expect(logger.warn).toHaveBeenCalledWith(
        "Insufficient scope for tool: forbidden-tool",
        {
          module: "AUTH",
          operation: "scope-check",
          entityId: "forbidden-tool",
        }
      );

      expect(formatOAuthError).toHaveBeenCalled();
      expect(mockRes.writeHead).toHaveBeenCalledWith(403, {
        "Content-Type": "application/json",
      });
      expect(mockRes.end).toHaveBeenCalledWith(
        JSON.stringify({ error: "insufficient_scope", tool: "forbidden-tool" })
      );
    });
  });
});
