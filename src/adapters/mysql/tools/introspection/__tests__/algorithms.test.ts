import { describe, it, expect } from "vitest";
import {
  detectCycles,
  topologicalSort,
  calculateMaxDepth,
} from "../algorithms.js";

describe("Graph Algorithms", () => {
  describe("detectCycles", () => {
    it("should detect simple cycles", () => {
      const adjacency = new Map<string, string[]>([
        ["A", ["B"]],
        ["B", ["C"]],
        ["C", ["A"]],
      ]);
      const cycles = detectCycles(adjacency);
      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0]).toEqual(["A", "B", "C", "A"]);
    });

    it("should return empty array for acyclic graphs", () => {
      const adjacency = new Map<string, string[]>([
        ["A", ["B"]],
        ["B", ["C"]],
        ["C", []],
      ]);
      expect(detectCycles(adjacency)).toEqual([]);
    });
  });

  describe("topologicalSort", () => {
    it("should return sorted array for DAG", () => {
      const allNodes = new Set(["A", "B", "C"]);
      const adjacency = new Map<string, string[]>([
        ["A", ["B"]],
        ["B", ["C"]],
        ["C", []],
      ]);
      const sorted = topologicalSort(adjacency, allNodes);
      expect(sorted).toEqual(["A", "B", "C"]);
    });

    it("should handle disjoint subgraphs", () => {
      const allNodes = new Set(["A", "B", "C", "D"]);
      const adjacency = new Map<string, string[]>([
        ["A", ["B"]],
        ["C", ["D"]],
      ]);
      const sorted = topologicalSort(adjacency, allNodes);
      expect(sorted).toEqual(["A", "B", "C", "D"]);
    });

    it("should return null if cycle exists", () => {
      const allNodes = new Set(["A", "B", "C"]);
      const adjacency = new Map<string, string[]>([
        ["A", ["B"]],
        ["B", ["C"]],
        ["C", ["A"]],
      ]);
      expect(topologicalSort(adjacency, allNodes)).toBeNull();
    });
  });

  describe("calculateMaxDepth", () => {
    it("should return correct max depth", () => {
      const adjacency = new Map<string, string[]>([
        ["A", ["B", "C"]],
        ["B", ["D"]],
        ["C", ["D"]],
        ["D", ["E"]],
      ]);
      expect(calculateMaxDepth(adjacency, ["A"])).toBe(3);
    });

    it("should return 0 for no roots", () => {
      expect(calculateMaxDepth(new Map(), [])).toBe(0);
    });
  });
});
