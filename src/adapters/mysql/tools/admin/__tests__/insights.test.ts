import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAppendInsightTool } from "../insights.js";
import { insightsManager } from "../../../../../utils/insights-manager.js";
import { ErrorCategory } from "../../../../../types/index.js";

vi.mock("../../../../../utils/insights-manager.js", () => ({
  insightsManager: {
    append: vi.fn(),
    count: vi.fn(),
  },
}));

describe("insights tool", () => {
  let mockContext: any;
  const tool = createAppendInsightTool();

  beforeEach(() => {
    mockContext = {};
    vi.clearAllMocks();
  });

  describe("createAppendInsightTool", () => {
    it("should return correct tool definition", () => {
      expect(tool.name).toBe("mysql_append_insight");
      expect(tool.group).toBe("admin");
    });

    it("should append a valid insight", async () => {
      vi.mocked(insightsManager.count).mockReturnValue(1);

      const result = await tool.handler(
        { insight: "This is a valuable insight." },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result as any).data.insightCount).toBe(1);
      expect((result as any).data.message).toBe("Insight recorded (1 total)");
      expect(insightsManager.append).toHaveBeenCalledWith("This is a valuable insight.");
    });

    it("should return validation error for empty insight", async () => {
      const result = await tool.handler(
        { insight: "   " },
        mockContext
      );

      expect(result.success).toBe(false);
      expect((result as any).error).toContain("Insight text cannot be empty");
      expect((result as any).category).toBe(ErrorCategory.VALIDATION);
      expect(insightsManager.append).not.toHaveBeenCalled();
    });

    it("should return validation error for missing insight", async () => {
      const result = await tool.handler({}, mockContext);

      expect(result.success).toBe(false);
      expect((result as any).category).toBe(ErrorCategory.VALIDATION);
      expect(insightsManager.append).not.toHaveBeenCalled();
    });

    it("should return validation error if insight is too long", async () => {
      const longInsight = "a".repeat(1001);
      const result = await tool.handler(
        { insight: longInsight },
        mockContext
      );

      expect(result.success).toBe(false);
      expect((result as any).error).toContain("Insight text is too long (1001 chars). Maximum allowed is 1000 characters.");
      expect((result as any).category).toBe(ErrorCategory.VALIDATION);
      expect(insightsManager.append).not.toHaveBeenCalled();
    });

    it("should allow insight of exactly 1000 characters", async () => {
      const exactInsight = "a".repeat(1000);
      vi.mocked(insightsManager.count).mockReturnValue(5);

      const result = await tool.handler(
        { insight: exactInsight },
        mockContext
      );

      expect(result.success).toBe(true);
      expect((result as any).data.insightCount).toBe(5);
      expect(insightsManager.append).toHaveBeenCalledWith(exactInsight);
    });

    it("should catch errors and format them", async () => {
      vi.mocked(insightsManager.append).mockImplementation(() => {
        throw new Error("Failed to write insight");
      });

      const result = await tool.handler(
        { insight: "Valid insight" },
        mockContext
      );

      expect(result.success).toBe(false);
      expect((result as any).error).toContain("Failed to write insight");
    });
  });
});
