import { describe, it, expect } from "vitest";
import { createMockRequestContext } from "../../../../__tests__/mocks/index.js";
import { createIndexTuningPrompt } from "../indexTuning.js";

describe("Index Tuning Prompt", () => {
  it("should generate generic tuning advice when no table specified", async () => {
    const prompt = createIndexTuningPrompt();
    const result = await prompt.handler!({}, createMockRequestContext());

    expect(result).toContain(
      "Analyze and optimize indexes across the database",
    );
    expect(result).toContain(
      "Start by reviewing the `mysql://indexes` resource.",
    );
    expect(result).not.toContain("table: **");
  });

  it("should generate table-specific tuning advice when table specified", async () => {
    const prompt = createIndexTuningPrompt();
    const result = await prompt.handler!(
      { table: "users" },
      createMockRequestContext(),
    );

    expect(result).toContain(
      "Analyze and optimize indexes for table: **users**",
    );
    expect(result).toContain("Start by analyzing indexes on table **users**.");
  });

  it("should have correct required argument metadata", () => {
    const prompt = createIndexTuningPrompt();
    expect(prompt.name).toBe("mysql_index_tuning");
    expect(prompt.arguments).toHaveLength(1);
    expect(prompt.arguments![0].name).toBe("table");
    expect(prompt.arguments![0].required).toBe(false);
  });
});
