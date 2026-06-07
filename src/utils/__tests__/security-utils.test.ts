import { describe, it, expect } from "vitest";
import { resolve, join } from "node:path";
import {
  parseAllowedIoRoots,
  assertSafeIoPath,
  IoPathError,
} from "../security-utils.js";
import { ValidationError } from "../../types/index.js";

describe("security-utils", () => {
  describe("parseAllowedIoRoots", () => {
    it("returns undefined for empty input", () => {
      expect(parseAllowedIoRoots(undefined)).toBeUndefined();
      expect(parseAllowedIoRoots("")).toBeUndefined();
    });

    it("parses valid comma-separated absolute paths", () => {
      const p1 = resolve("/path/one");
      const p2 = resolve("/path/two");
      const result = parseAllowedIoRoots(`${p1}, ${p2}`);
      expect(result).toEqual([p1, p2]);
    });

    it("parses valid JSON array of absolute paths", () => {
      const p1 = resolve("/path/one");
      const p2 = resolve("/path/two");
      const result = parseAllowedIoRoots(JSON.stringify([p1, p2]));
      expect(result).toEqual([p1, p2]);
    });

    it("throws ValidationError for non-absolute paths in comma-separated list", () => {
      expect(() => parseAllowedIoRoots("relative/path")).toThrow(
        ValidationError
      );
      expect(() => parseAllowedIoRoots("relative/path")).toThrow(
        "All paths must be absolute"
      );
    });

    it("throws ValidationError for invalid JSON", () => {
      expect(() => parseAllowedIoRoots("[invalid json")).toThrow(
        ValidationError
      );
    });

    it("throws ValidationError for JSON array with non-absolute paths", () => {
      expect(() => parseAllowedIoRoots(JSON.stringify(["relative/path"]))).toThrow(
        ValidationError
      );
    });

    it("throws ValidationError if input exceeds 50KB", () => {
      const hugeInput = "a".repeat(51201);
      expect(() => parseAllowedIoRoots(hugeInput)).toThrow(ValidationError);
    });
  });

  describe("assertSafeIoPath", () => {
    const safeRoot = resolve("/safe/sandbox");
    const allowedRoots = [safeRoot];

    it("succeeds for valid paths within allowed roots", () => {
      const validPath = join(safeRoot, "export.csv");
      expect(() =>
        assertSafeIoPath(validPath, allowedRoots, true)
      ).not.toThrow();
    });

    it("throws IoPathError when allowedRoots is empty", () => {
      const validPath = join(safeRoot, "export.csv");
      expect(() => assertSafeIoPath(validPath, [], true)).toThrow(IoPathError);
    });

    it("throws IoPathError if target path escapes the sandbox", () => {
      const outsidePath = resolve("/outside/path/export.csv");
      expect(() => assertSafeIoPath(outsidePath, allowedRoots, true)).toThrow(
        IoPathError
      );
    });

    it("throws IoPathError for null bytes", () => {
      const badPath = join(safeRoot, "export\x00.csv");
      expect(() => assertSafeIoPath(badPath, allowedRoots, true)).toThrow(
        IoPathError
      );
      expect(() => assertSafeIoPath(badPath, allowedRoots, true)).toThrow(
        "null bytes"
      );
    });

    it("throws IoPathError for schemes and query params", () => {
      expect(() =>
        assertSafeIoPath(`file://${safeRoot}/export.csv`, allowedRoots, true)
      ).toThrow(IoPathError);
      expect(() =>
        assertSafeIoPath(join(safeRoot, "export.csv?param=1"), allowedRoots, true)
      ).toThrow(IoPathError);
    });

    it("throws IoPathError for path traversal strings", () => {
      // Using /../ physically in the string
      // Using /../ physically in the string
      // Wait, join might resolve .. but if we explicitly inject it:
      const rawTraversal = `${safeRoot}/../export.csv`;
      expect(() => assertSafeIoPath(rawTraversal, allowedRoots, true)).toThrow(
        IoPathError
      );
    });

    it("throws IoPathError for hidden files / dotfiles", () => {
      const dotfile = join(safeRoot, ".hidden.csv");
      expect(() => assertSafeIoPath(dotfile, allowedRoots, true)).toThrow(
        IoPathError
      );
    });

    it("throws IoPathError for invalid extensions when validateExtension is true", () => {
      const badExt = join(safeRoot, "script.js");
      expect(() => assertSafeIoPath(badExt, allowedRoots, true)).toThrow(
        IoPathError
      );
    });

    it("succeeds for invalid extensions when validateExtension is false", () => {
      const badExt = join(safeRoot, "script.js");
      expect(() =>
        assertSafeIoPath(badExt, allowedRoots, false)
      ).not.toThrow();
    });
  });
});
