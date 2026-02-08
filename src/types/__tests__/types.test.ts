/**
 * mysql-mcp - Types Unit Tests
 *
 * Tests for error classes defined in types/index.ts
 */

import { describe, it, expect } from "vitest";
import {
  MySQLMcpError,
  ConnectionError,
  PoolError,
  QueryError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  TransactionError,
} from "../index.js";

describe("Error Classes", () => {
  describe("MySQLMcpError", () => {
    it("should create error with message and code", () => {
      const error = new MySQLMcpError("Test error", "TEST_CODE");
      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.name).toBe("MySQLMcpError");
    });

    it("should create error with details", () => {
      const details = { table: "users", operation: "insert" };
      const error = new MySQLMcpError("Test error", "TEST_CODE", details);
      expect(error.details).toEqual(details);
    });

    it("should be instance of Error", () => {
      const error = new MySQLMcpError("Test", "CODE");
      expect(error).toBeInstanceOf(Error);
    });

    it("should have stack trace", () => {
      const error = new MySQLMcpError("Test", "CODE");
      expect(error.stack).toBeDefined();
    });
  });

  describe("ConnectionError", () => {
    it("should create with correct code", () => {
      const error = new ConnectionError("Connection failed");
      expect(error.code).toBe("CONNECTION_ERROR");
      expect(error.name).toBe("ConnectionError");
    });

    it("should be instance of MySQLMcpError", () => {
      const error = new ConnectionError("Failed");
      expect(error).toBeInstanceOf(MySQLMcpError);
    });

    it("should accept details", () => {
      const error = new ConnectionError("Failed", { host: "localhost" });
      expect(error.details?.["host"]).toBe("localhost");
    });
  });

  describe("PoolError", () => {
    it("should create with correct code", () => {
      const error = new PoolError("Pool exhausted");
      expect(error.code).toBe("POOL_ERROR");
      expect(error.name).toBe("PoolError");
    });

    it("should be instance of MySQLMcpError", () => {
      const error = new PoolError("Exhausted");
      expect(error).toBeInstanceOf(MySQLMcpError);
    });

    it("should accept details", () => {
      const error = new PoolError("Exhausted", { active: 10, limit: 10 });
      expect(error.details).toEqual({ active: 10, limit: 10 });
    });
  });

  describe("QueryError", () => {
    it("should create with correct code", () => {
      const error = new QueryError("Query failed");
      expect(error.code).toBe("QUERY_ERROR");
      expect(error.name).toBe("QueryError");
    });

    it("should be instance of MySQLMcpError", () => {
      const error = new QueryError("Failed");
      expect(error).toBeInstanceOf(MySQLMcpError);
    });

    it("should accept SQL in details", () => {
      const error = new QueryError("Syntax error", {
        sql: "SELECT * FORM users",
      });
      expect(error.details?.["sql"]).toContain("FORM");
    });
  });

  describe("AuthenticationError", () => {
    it("should create with correct code", () => {
      const error = new AuthenticationError("Invalid credentials");
      expect(error.code).toBe("AUTHENTICATION_ERROR");
      expect(error.name).toBe("AuthenticationError");
    });

    it("should be instance of MySQLMcpError", () => {
      const error = new AuthenticationError("Invalid");
      expect(error).toBeInstanceOf(MySQLMcpError);
    });

    it("should accept details", () => {
      const error = new AuthenticationError("Failed", {
        reason: "expired_token",
      });
      expect(error.details?.["reason"]).toBe("expired_token");
    });
  });

  describe("AuthorizationError", () => {
    it("should create with correct code", () => {
      const error = new AuthorizationError("Insufficient permissions");
      expect(error.code).toBe("AUTHORIZATION_ERROR");
      expect(error.name).toBe("AuthorizationError");
    });

    it("should be instance of MySQLMcpError", () => {
      const error = new AuthorizationError("Forbidden");
      expect(error).toBeInstanceOf(MySQLMcpError);
    });

    it("should accept details", () => {
      const error = new AuthorizationError("Denied", {
        requiredScope: "write",
        userScopes: ["read"],
      });
      expect(error.details?.["requiredScope"]).toBe("write");
    });
  });

  describe("ValidationError", () => {
    it("should create with correct code", () => {
      const error = new ValidationError("Invalid input");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.name).toBe("ValidationError");
    });

    it("should be instance of MySQLMcpError", () => {
      const error = new ValidationError("Invalid");
      expect(error).toBeInstanceOf(MySQLMcpError);
    });

    it("should accept details with field info", () => {
      const error = new ValidationError("Invalid field", {
        field: "email",
        value: "not-an-email",
        expected: "valid email format",
      });
      expect(error.details?.["field"]).toBe("email");
    });
  });

  describe("TransactionError", () => {
    it("should create with correct code", () => {
      const error = new TransactionError("Transaction failed");
      expect(error.code).toBe("TRANSACTION_ERROR");
      expect(error.name).toBe("TransactionError");
    });

    it("should be instance of MySQLMcpError", () => {
      const error = new TransactionError("Failed");
      expect(error).toBeInstanceOf(MySQLMcpError);
    });

    it("should accept details with transaction ID", () => {
      const error = new TransactionError("Rollback failed", {
        transactionId: "txn-12345",
        reason: "deadlock",
      });
      expect(error.details?.["transactionId"]).toBe("txn-12345");
    });
  });

  describe("Error inheritance chain", () => {
    it("should maintain proper prototype chain for all errors", () => {
      const errors = [
        new ConnectionError("test"),
        new PoolError("test"),
        new QueryError("test"),
        new AuthenticationError("test"),
        new AuthorizationError("test"),
        new ValidationError("test"),
        new TransactionError("test"),
      ];

      for (const error of errors) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(MySQLMcpError);
        expect(typeof error.message).toBe("string");
        expect(typeof error.code).toBe("string");
      }
    });
  });
});
