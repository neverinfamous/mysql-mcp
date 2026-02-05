/**
 * mysql-mcp - Scopes Unit Tests
 *
 * Tests for OAuth scope utilities.
 */

import { describe, it, expect } from "vitest";
import {
  SCOPES,
  parseScopes,
  hasScope,
  hasAnyScope,
  hasAllScopes,
  getScopeForToolGroup,
  hasDatabaseScope,
  hasTableScope,
  getScopeDisplayName,
} from "../scopes.js";

describe("parseScopes", () => {
  it("should parse space-delimited scope string", () => {
    expect(parseScopes("read write admin")).toEqual(["read", "write", "admin"]);
  });

  it("should return empty array for undefined", () => {
    expect(parseScopes(undefined)).toEqual([]);
  });

  it("should return empty array for empty string", () => {
    expect(parseScopes("")).toEqual([]);
  });

  it("should handle single scope", () => {
    expect(parseScopes("read")).toEqual(["read"]);
  });
});

describe("hasScope", () => {
  it("should return true for direct match", () => {
    expect(hasScope(["read", "write"], "read")).toBe(true);
  });

  it("should return false when scope not present", () => {
    expect(hasScope(["read"], "write")).toBe(false);
  });

  it("should grant all scopes when full is present", () => {
    expect(hasScope(["full"], "read")).toBe(true);
    expect(hasScope(["full"], "write")).toBe(true);
    expect(hasScope(["full"], "admin")).toBe(true);
  });

  it("should grant read and write when admin is present", () => {
    expect(hasScope(["admin"], "read")).toBe(true);
    expect(hasScope(["admin"], "write")).toBe(true);
  });

  it("should grant read when write is present", () => {
    expect(hasScope(["write"], "read")).toBe(true);
  });

  it("should not grant write when only read is present", () => {
    expect(hasScope(["read"], "write")).toBe(false);
  });
});

describe("hasAnyScope", () => {
  it("should return true if any scope matches", () => {
    expect(hasAnyScope(["read"], ["read", "write"])).toBe(true);
  });

  it("should return false if no scopes match", () => {
    expect(hasAnyScope(["read"], ["write", "admin"])).toBe(false);
  });
});

describe("hasAllScopes", () => {
  it("should return true if all scopes match", () => {
    expect(hasAllScopes(["read", "write", "admin"], ["read", "write"])).toBe(
      true,
    );
  });

  it("should return false if not all scopes match", () => {
    expect(hasAllScopes(["read"], ["read", "write"])).toBe(false);
  });
});

describe("getScopeForToolGroup", () => {
  it("should return read for query tools", () => {
    expect(getScopeForToolGroup("core")).toBe(SCOPES.READ);
    expect(getScopeForToolGroup("json")).toBe(SCOPES.READ);
    expect(getScopeForToolGroup("text")).toBe(SCOPES.READ);
  });

  it("should return write for transaction tools", () => {
    expect(getScopeForToolGroup("transactions")).toBe(SCOPES.WRITE);
  });

  it("should return admin for admin tools", () => {
    expect(getScopeForToolGroup("admin")).toBe(SCOPES.ADMIN);
    expect(getScopeForToolGroup("backup")).toBe(SCOPES.ADMIN);
    expect(getScopeForToolGroup("shell")).toBe(SCOPES.ADMIN);
  });
});

describe("hasDatabaseScope", () => {
  it("should return true for full scope", () => {
    expect(hasDatabaseScope(["full"], "mydb")).toBe(true);
  });

  it("should return true for admin scope", () => {
    expect(hasDatabaseScope(["admin"], "mydb")).toBe(true);
  });

  it("should return true for matching db: pattern", () => {
    expect(hasDatabaseScope(["db:mydb"], "mydb")).toBe(true);
  });

  it("should return false for non-matching db: pattern", () => {
    expect(hasDatabaseScope(["db:otherdb"], "mydb")).toBe(false);
  });
});

describe("hasTableScope", () => {
  it("should return true for full scope", () => {
    expect(hasTableScope(["full"], "mydb", "users")).toBe(true);
  });

  it("should return true for admin scope", () => {
    expect(hasTableScope(["admin"], "mydb", "users")).toBe(true);
  });

  it("should return true for matching database scope", () => {
    expect(hasTableScope(["db:mydb"], "mydb", "users")).toBe(true);
  });

  it("should return true for matching table: pattern", () => {
    expect(hasTableScope(["table:mydb:users"], "mydb", "users")).toBe(true);
  });

  it("should return false for non-matching table: pattern", () => {
    expect(hasTableScope(["table:mydb:products"], "mydb", "users")).toBe(false);
  });
});

describe("getScopeDisplayName", () => {
  it("should return display names for standard scopes", () => {
    expect(getScopeDisplayName("read")).toBe("Read Only");
    expect(getScopeDisplayName("write")).toBe("Read/Write");
    expect(getScopeDisplayName("admin")).toBe("Administrative");
    expect(getScopeDisplayName("full")).toBe("Full Access");
  });

  it("should format db: scopes", () => {
    expect(getScopeDisplayName("db:mydb")).toBe("Database: mydb");
  });

  it("should format table: scopes", () => {
    expect(getScopeDisplayName("table:mydb:users")).toBe("Table: mydb:users");
  });

  it("should return unknown scopes as-is", () => {
    expect(getScopeDisplayName("custom_scope")).toBe("custom_scope");
  });
});
