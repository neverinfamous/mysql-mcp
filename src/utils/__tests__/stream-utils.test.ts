import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamResultRows } from "../stream-utils.js";
import { progressFactory } from "../../progress/index.js";

vi.mock("../../progress/index.js", () => ({
  progressFactory: {
    create: vi.fn(),
  },
}));

describe("stream-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("streamResultRows", () => {
    it("should return 0 if rows array is empty", () => {
      const result = streamResultRows("token-1", []);
      expect(result).toBe(0);
      expect(progressFactory.create).not.toHaveBeenCalled();
    });

    it("should return 0 if progress reporter cannot be created", () => {
      vi.mocked(progressFactory.create).mockReturnValue(null);
      const rows = [{ id: 1 }];
      
      const result = streamResultRows("token-1", rows);
      expect(result).toBe(0);
      expect(progressFactory.create).toHaveBeenCalledWith("token-1");
    });

    it("should stream rows in chunks of STREAM_CHUNK_SIZE", () => {
      const mockReporter = { report: vi.fn() };
      vi.mocked(progressFactory.create).mockReturnValue(mockReporter as any);
      
      const rows = Array.from({ length: 25 }, (_, i) => ({ id: i }));
      
      const result = streamResultRows("token-1", rows);
      
      expect(result).toBe(3); // 25 rows / 10 = 3 chunks (10, 10, 5)
      expect(progressFactory.create).toHaveBeenCalledWith("token-1");
      expect(mockReporter.report).toHaveBeenCalledTimes(3);
      
      // First chunk
      expect(mockReporter.report).toHaveBeenNthCalledWith(1, 1, 3, JSON.stringify(rows.slice(0, 10)));
      // Second chunk
      expect(mockReporter.report).toHaveBeenNthCalledWith(2, 2, 3, JSON.stringify(rows.slice(10, 20)));
      // Third chunk
      expect(mockReporter.report).toHaveBeenNthCalledWith(3, 3, 3, JSON.stringify(rows.slice(20, 25)));
    });

    it("should handle custom chunk size", () => {
      const mockReporter = { report: vi.fn() };
      vi.mocked(progressFactory.create).mockReturnValue(mockReporter as any);
      
      const rows = Array.from({ length: 5 }, (_, i) => ({ id: i }));
      
      const result = streamResultRows("token-1", rows, 2);
      
      expect(result).toBe(3); // 5 rows / 2 = 3 chunks (2, 2, 1)
      expect(mockReporter.report).toHaveBeenCalledTimes(3);
    });

    it("should fallback to chunk size 1 if less than 1 is provided", () => {
      const mockReporter = { report: vi.fn() };
      vi.mocked(progressFactory.create).mockReturnValue(mockReporter as any);
      
      const rows = [{ id: 1 }, { id: 2 }];
      
      const result = streamResultRows("token-1", rows, 0);
      
      expect(result).toBe(2);
      expect(mockReporter.report).toHaveBeenCalledTimes(2);
    });
  });
});
