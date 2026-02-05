/**
 * mysql-mcp - Input Validators Tests
 */

import { describe, it, expect } from "vitest";
import {
  ValidationError,
  validateIdentifier,
  validateQualifiedIdentifier,
  escapeIdentifier,
  validateWhereClause,
  escapeLikePattern,
} from "../validators.js";

describe("validators", () => {
  describe("validateIdentifier", () => {
    it("should accept valid identifiers", () => {
      expect(() => validateIdentifier("users", "table")).not.toThrow();
      expect(() => validateIdentifier("_private", "table")).not.toThrow();
      expect(() => validateIdentifier("table123", "table")).not.toThrow();
      expect(() => validateIdentifier("User_Data", "column")).not.toThrow();
    });

    it("should reject identifiers starting with numbers", () => {
      expect(() => validateIdentifier("123table", "table")).toThrow(
        ValidationError,
      );
    });

    it("should reject identifiers with special characters", () => {
      expect(() => validateIdentifier("table-name", "table")).toThrow(
        ValidationError,
      );
      expect(() => validateIdentifier("table name", "table")).toThrow(
        ValidationError,
      );
      expect(() => validateIdentifier("table;drop", "table")).toThrow(
        ValidationError,
      );
    });

    it("should reject empty identifiers", () => {
      expect(() => validateIdentifier("", "table")).toThrow(ValidationError);
    });

    it("should reject identifiers exceeding 64 characters", () => {
      const longName = "a".repeat(65);
      expect(() => validateIdentifier(longName, "table")).toThrow(
        ValidationError,
      );
    });

    it("should accept identifiers at exactly 64 characters", () => {
      const maxLengthName = "a".repeat(64);
      expect(() => validateIdentifier(maxLengthName, "table")).not.toThrow();
    });
  });

  describe("validateQualifiedIdentifier", () => {
    it("should accept simple identifiers", () => {
      expect(() => validateQualifiedIdentifier("users", "table")).not.toThrow();
    });

    it("should accept schema.table format", () => {
      expect(() =>
        validateQualifiedIdentifier("mydb.users", "table"),
      ).not.toThrow();
    });

    it("should reject invalid qualified names", () => {
      expect(() =>
        validateQualifiedIdentifier("db.table.column", "table"),
      ).toThrow(ValidationError);
    });
  });

  describe("escapeIdentifier", () => {
    it("should escape backticks", () => {
      expect(escapeIdentifier("table`name")).toBe("table``name");
    });

    it("should return unchanged for safe identifiers", () => {
      expect(escapeIdentifier("users")).toBe("users");
    });
  });

  describe("validateWhereClause", () => {
    it("should accept simple conditions", () => {
      expect(() => validateWhereClause("id = 1")).not.toThrow();
      expect(() => validateWhereClause("name = 'John'")).not.toThrow();
      expect(() => validateWhereClause("status IN (1, 2, 3)")).not.toThrow();
    });

    it("should accept complex valid conditions", () => {
      expect(() =>
        validateWhereClause("created_at > '2024-01-01' AND status = 'active'"),
      ).not.toThrow();
      expect(() => validateWhereClause("name LIKE '%test%'")).not.toThrow();
      expect(() =>
        validateWhereClause("(a = 1 OR b = 2) AND c = 3"),
      ).not.toThrow();
    });

    it("should accept NULL and empty values", () => {
      expect(() => validateWhereClause("")).not.toThrow();
      expect(() =>
        validateWhereClause(null as unknown as string),
      ).not.toThrow();
    });

    it("should reject stacked queries", () => {
      expect(() => validateWhereClause("1=1; DROP TABLE users")).toThrow(
        ValidationError,
      );
      expect(() => validateWhereClause("id = 1; DELETE FROM users")).toThrow(
        ValidationError,
      );
    });

    it("should reject SQL comments", () => {
      expect(() => validateWhereClause("id = 1 --")).toThrow(ValidationError);
      expect(() => validateWhereClause("id = 1 /* comment */")).toThrow(
        ValidationError,
      );
    });

    it("should reject UNION attacks", () => {
      expect(() =>
        validateWhereClause("1=1 UNION SELECT * FROM passwords"),
      ).toThrow(ValidationError);
      expect(() =>
        validateWhereClause("1=1 UNION ALL SELECT password FROM users"),
      ).toThrow(ValidationError);
    });

    it("should reject file operations", () => {
      expect(() => validateWhereClause("1=1 INTO OUTFILE '/tmp/data'")).toThrow(
        ValidationError,
      );
      expect(() => validateWhereClause("LOAD_FILE('/etc/passwd')")).toThrow(
        ValidationError,
      );
    });

    it("should reject timing attacks", () => {
      expect(() => validateWhereClause("1=1 AND SLEEP(5)")).toThrow(
        ValidationError,
      );
      expect(() =>
        validateWhereClause("BENCHMARK(1000000, SHA1('test'))"),
      ).toThrow(ValidationError);
    });

    it("should reject unbalanced quotes", () => {
      expect(() => validateWhereClause("id = 1 OR '1'='1")).toThrow(
        ValidationError,
      );
    });

    it("should accept escaped quotes", () => {
      expect(() => validateWhereClause("name = 'O''Brien'")).not.toThrow();
    });
  });

  describe("escapeLikePattern", () => {
    it("should escape single quotes", () => {
      expect(escapeLikePattern("O'Brien")).toBe("O''Brien");
    });

    it("should return unchanged for safe patterns", () => {
      expect(escapeLikePattern("%test%")).toBe("%test%");
    });
  });

  describe("Additional Validation coverage", () => {
    it("should reject empty qualified identifiers", () => {
      expect(() => validateQualifiedIdentifier("", "table")).toThrow(
        ValidationError,
      );
    });

    it("should reject non-string qualified identifiers", () => {
      expect(() =>
        validateQualifiedIdentifier(null as unknown as string, "table"),
      ).toThrow(ValidationError);
    });

    it("should handle unbalanced double quotes in WHERE", () => {
      expect(() => validateWhereClause('name = "foo"')).not.toThrow();
      expect(() => validateWhereClause('name = "foo')).toThrow(ValidationError);
    });

    it("should return early for empty WHERE clause", () => {
      expect(() => validateWhereClause("")).not.toThrow();
      expect(() => validateWhereClause("   ")).not.toThrow();
    });
  });
});
