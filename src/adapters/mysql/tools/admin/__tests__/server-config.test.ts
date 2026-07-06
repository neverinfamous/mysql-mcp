import { describe, it, expect, vi, beforeEach } from "vitest";
import { createServerConfigTool } from "../server-config.js";
import { logger } from "../../../../../utils/logger.js";
import * as authContext from "../../../../../auth/auth-context.js";
import { SCOPES } from "../../../../../auth/scopes.js";
import { ErrorCategory } from "../../../../../types/index.js";

vi.mock("../../../../../utils/logger.js", () => ({
  logger: {
    getLevel: vi.fn(),
    setLevel: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../../../../auth/auth-context.js", () => ({
  getAuthContext: vi.fn(),
}));

describe("server-config", () => {
  let mockContext: any;
  const tool = createServerConfigTool();

  beforeEach(() => {
    mockContext = {};
    vi.clearAllMocks();
  });

  describe("createServerConfigTool", () => {
    it("should return correct tool definition", () => {
      expect(tool.name).toBe("mysql_server_config");
      expect(tool.group).toBe("admin");
      expect(tool.requiredScopes).toEqual([SCOPES.ADMIN]);
    });

    it("should enforce ADMIN scope", async () => {
      vi.mocked(authContext.getAuthContext).mockReturnValue({
        token: "test",
        user: "test",
        scopes: [SCOPES.READ], // Missing ADMIN
      });

      const result = await tool.handler({ action: "get" }, mockContext);
      expect(result.success).toBe(false);
      expect((result as any).error).toContain("Insufficient scope");
      expect((result as any).code).toBe("AUTH_INSUFFICIENT_SCOPE");
    });

    it("should handle 'get' action", async () => {
      vi.mocked(authContext.getAuthContext).mockReturnValue({
        token: "test",
        user: "test",
        scopes: [SCOPES.ADMIN],
      });
      vi.mocked(logger.getLevel).mockReturnValue("info");

      const result = await tool.handler({ action: "get" }, mockContext);
      expect(result.success).toBe(true);
      expect((result as any).data.config.logLevel).toBe("info");
      expect(logger.getLevel).toHaveBeenCalled();
    });

    it("should handle 'set' action for valid logLevel", async () => {
      vi.mocked(authContext.getAuthContext).mockReturnValue({
        token: "test",
        user: "test",
        scopes: [SCOPES.ADMIN],
      });

      const result = await tool.handler(
        { action: "set", setting: "logLevel", value: "debug" },
        mockContext
      );
      
      expect(result.success).toBe(true);
      expect((result as any).data.message).toContain("Log level successfully updated to debug");
      expect(logger.setLevel).toHaveBeenCalledWith("debug");
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Log level dynamically changed to debug"),
        expect.any(Object)
      );
    });

    it("should return validation error for invalid logLevel", async () => {
      vi.mocked(authContext.getAuthContext).mockReturnValue({
        token: "test",
        user: "test",
        scopes: [SCOPES.ADMIN],
      });

      const result = await tool.handler(
        { action: "set", setting: "logLevel", value: "invalid_level" },
        mockContext
      );
      
      expect(result.success).toBe(false);
      expect((result as any).error).toContain("Invalid log level");
      expect((result as any).category).toBe(ErrorCategory.VALIDATION);
      expect(logger.setLevel).not.toHaveBeenCalled();
    });

    it("should return validation error for set action without value", async () => {
      vi.mocked(authContext.getAuthContext).mockReturnValue({
        token: "test",
        user: "test",
        scopes: [SCOPES.ADMIN],
      });

      const result = await tool.handler(
        { action: "set", setting: "logLevel" },
        mockContext
      );
      
      expect(result.success).toBe(false);
      expect((result as any).error).toContain("setting and value are required for 'set' action");
      expect(logger.setLevel).not.toHaveBeenCalled();
    });

    it("should handle invalid params structure", async () => {
      vi.mocked(authContext.getAuthContext).mockReturnValue({
        token: "test",
        user: "test",
        scopes: [SCOPES.ADMIN],
      });

      const result = await tool.handler({ action: "unknown" }, mockContext);
      
      expect(result.success).toBe(false);
      expect((result as any).category).toBe(ErrorCategory.VALIDATION);
    });

    it("should catch errors and format them", async () => {
      vi.mocked(authContext.getAuthContext).mockReturnValue({
        token: "test",
        user: "test",
        scopes: [SCOPES.ADMIN],
      });
      
      // Force an error inside the handler by making logger.getLevel throw
      vi.mocked(logger.getLevel).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const result = await tool.handler({ action: "get" }, mockContext);
      expect(result.success).toBe(false);
      expect((result as any).error).toContain("Unexpected error");
    });
  });
});
