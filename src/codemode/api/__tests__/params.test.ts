import { describe, it, expect, vi } from "vitest";
import { normalizeParams } from "../params.js";

vi.mock("../constants/positional.js", () => ({
  POSITIONAL_PARAM_MAP: {
    singleStringMethod: "strParam",
    multiStringMethod: ["firstParam", "secondParam"],
    restMethod: ["firstParam", "...restParams"],
  },
  ARRAY_WRAP_MAP: {
    arrayWrapMethod: "items",
  },
}));

describe("normalizeParams", () => {
  it("should return undefined for empty args", () => {
    expect(normalizeParams("anyMethod", [])).toBeUndefined();
  });

  describe("single argument handling", () => {
    it("should pass through object arguments", () => {
      const obj = { key: "value" };
      expect(normalizeParams("anyMethod", [obj])).toBe(obj);
    });

    it("should wrap array arguments if in ARRAY_WRAP_MAP", () => {
      const arr = [1, 2, 3];
      expect(normalizeParams("arrayWrapMethod", [arr])).toEqual({ items: arr });
    });

    it("should pass through array arguments if not in ARRAY_WRAP_MAP", () => {
      const arr = [1, 2, 3];
      expect(normalizeParams("anyMethod", [arr])).toBe(arr);
    });

    it("should map single string arg to string property if in POSITIONAL_PARAM_MAP", () => {
      expect(normalizeParams("singleStringMethod", ["val"])).toEqual({
        strParam: "val",
      });
    });

    it("should map single string arg to first array property if in POSITIONAL_PARAM_MAP", () => {
      expect(normalizeParams("multiStringMethod", ["val"])).toEqual({
        firstParam: "val",
      });
    });

    it("should fallback to common param names for unmapped string arg", () => {
      expect(normalizeParams("unknownMethod", ["val"])).toEqual({
        sql: "val",
        query: "val",
        table: "val",
        name: "val",
      });
    });

    it("should pass through unmapped non-string/non-array/non-object primitives", () => {
      expect(normalizeParams("anyMethod", [123])).toBe(123);
      expect(normalizeParams("anyMethod", [true])).toBe(true);
      expect(normalizeParams("anyMethod", [null])).toBe(null);
    });
  });

  describe("multiple argument handling", () => {
    it("should wrap array arg and merge with options arg", () => {
      const arr = [1, 2, 3];
      const opts = { extra: "data" };
      expect(normalizeParams("arrayWrapMethod", [arr, opts])).toEqual({
        items: arr,
        extra: "data",
      });
    });

    it("should merge trailing options for string paramMapping", () => {
      expect(normalizeParams("singleStringMethod", ["val", { opt: 123 }])).toEqual({
        strParam: "val",
        opt: 123,
      });
    });

    it("should map rest parameters", () => {
      expect(normalizeParams("restMethod", ["val1", "val2", "val3"])).toEqual({
        firstParam: "val1",
        restParams: ["val2", "val3"],
      });
    });

    it("should map multiple string/primitive args to POSITIONAL_PARAM_MAP array", () => {
      expect(normalizeParams("multiStringMethod", ["val1", "val2"])).toEqual({
        firstParam: "val1",
        secondParam: "val2",
      });
    });

    it("should skip undefined arguments when mapping multiple args", () => {
      expect(normalizeParams("multiStringMethod", [undefined, "val2"])).toEqual(
        {
          secondParam: "val2",
        },
      );
    });

    it("should fall back to passing through the first argument if multiple args unmapped", () => {
      expect(normalizeParams("unknownMethod", ["val1", "val2"])).toBe("val1");
    });

    it("should merge mapped positional args with a trailing options object", () => {
      expect(
        normalizeParams("multiStringMethod", [
          "val1",
          "val2",
          { option: "opt1" },
        ]),
      ).toEqual({
        firstParam: "val1",
        secondParam: "val2",
        option: "opt1",
      });
    });
  });
});
