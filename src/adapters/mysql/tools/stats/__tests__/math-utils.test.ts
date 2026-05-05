import { describe, it, expect } from "vitest";
import { calculateTTestPValue, calculateZTestPValue } from "../math-utils.js";

describe("Math Utilities", () => {
  describe("calculateTTestPValue", () => {
    it("should calculate correct p-value for large t and df", () => {
      const p = calculateTTestPValue(5.0, 100);
      expect(p).toBeLessThan(0.001);
    });

    it("should calculate correct p-value for small t", () => {
      const p = calculateTTestPValue(0.0, 100);
      expect(p).toBeCloseTo(1.0, 3);
    });

    it("should handle negative t values symmetrically", () => {
      const pPos = calculateTTestPValue(2.0, 50);
      const pNeg = calculateTTestPValue(-2.0, 50);
      expect(pPos).toBeCloseTo(pNeg, 5);
    });

    it("should calculate correct approximate p-value for known values", () => {
      // t = 1.96, df = ∞ (large) approx equals z = 1.96 which is p ≈ 0.05
      const p = calculateTTestPValue(1.96, 1000);
      expect(p).toBeCloseTo(0.05, 2);
    });
  });

  describe("calculateZTestPValue", () => {
    it("should calculate correct p-value for large z", () => {
      const p = calculateZTestPValue(5.0);
      expect(p).toBeLessThan(0.001);
    });

    it("should calculate correct p-value for small z", () => {
      const p = calculateZTestPValue(0.0);
      expect(p).toBeCloseTo(1.0, 3);
    });

    it("should handle negative z values symmetrically", () => {
      const pPos = calculateZTestPValue(1.5);
      const pNeg = calculateZTestPValue(-1.5);
      expect(pPos).toBeCloseTo(pNeg, 5);
    });

    it("should calculate correct approximate p-value for known values", () => {
      // z = 1.96 should have p-value approx 0.05 (two-tailed)
      const p = calculateZTestPValue(1.96);
      expect(p).toBeCloseTo(0.05, 2);
      
      // z = 2.576 should have p-value approx 0.01 (two-tailed)
      const p2 = calculateZTestPValue(2.576);
      expect(p2).toBeCloseTo(0.01, 2);
    });
  });
});
