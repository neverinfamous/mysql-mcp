import { describe, it, expect, beforeEach } from "vitest";
import { insightsManager } from "../insights-manager.js";

describe("Insights Manager", () => {
  beforeEach(() => {
    insightsManager.clear();
  });

  it("should append and retrieve insights", () => {
    insightsManager.append("Insight 1");
    insightsManager.append("Insight 2");

    expect(insightsManager.count()).toBe(2);
    expect(insightsManager.getAll()).toEqual(["Insight 1", "Insight 2"]);
  });

  it("should ignore empty insights", () => {
    insightsManager.append("  ");
    insightsManager.append("");
    expect(insightsManager.count()).toBe(0);
  });

  it("should synthesize empty memo", () => {
    expect(insightsManager.synthesizeMemo()).toBe(
      "No business insights have been discovered yet.",
    );
  });

  it("should synthesize single insight memo", () => {
    insightsManager.append("One insight");
    const memo = insightsManager.synthesizeMemo();
    expect(memo).toContain("Key Insights Discovered:");
    expect(memo).toContain("- One insight");
    expect(memo).not.toContain("Summary:"); // Only added if > 1 insight
  });

  it("should synthesize multiple insights memo with summary", () => {
    insightsManager.append("First");
    insightsManager.append("Second");
    const memo = insightsManager.synthesizeMemo();
    expect(memo).toContain("- First");
    expect(memo).toContain("- Second");
    expect(memo).toContain("Summary:");
    expect(memo).toContain("suggest opportunities for strategic optimization");
  });
});
