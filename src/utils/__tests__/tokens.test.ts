import { describe, it, expect } from "vitest";
import { estimateTokens } from "../tokens.js";

describe("estimateTokens", () => {
  it("should estimate JSON tokens using 3 bytes per token", () => {
    // 30 bytes
    const text = '{"key":"value","number":12345}';
    expect(estimateTokens(text, "json")).toBe(10); // 30 / 3
  });

  it("should estimate SQL tokens using 3.5 bytes per token", () => {
    // 35 bytes
    const text = "SELECT * FROM users WHERE id = 123;";
    expect(estimateTokens(text, "sql")).toBe(10); // 35 / 3.5
  });

  it("should estimate text tokens using 4 bytes per token", () => {
    // 40 bytes
    const text = "This is a simple sentence with 40 bytes.";
    expect(estimateTokens(text, "text")).toBe(10); // 40 / 4
  });

  it("should fallback to text estimation if no content type provided", () => {
    // 40 bytes
    const text = "This is a simple sentence with 40 bytes.";
    expect(estimateTokens(text)).toBe(10); // 40 / 4
  });

  it("should handle empty strings", () => {
    expect(estimateTokens("", "json")).toBe(0);
    expect(estimateTokens("", "sql")).toBe(0);
    expect(estimateTokens("", "text")).toBe(0);
    expect(estimateTokens("")).toBe(0);
  });
});
