/**
 * mysql-mcp - Auth Context Unit Tests
 */

import { describe, it, expect } from "vitest";
import { runWithAuthContext, getAuthContext } from "../auth-context.js";
import type { AuthenticatedContext } from "../middleware.js";

describe("auth-context", () => {
  const mockContext: AuthenticatedContext = {
    authenticated: true,
    scopes: ["read", "write"],
    claims: {
      sub: "user-1",
      iss: "https://auth.example.com",
      aud: "mysql-mcp",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      scopes: ["read", "write"],
    },
  };

  it("should return undefined when no context is set", () => {
    expect(getAuthContext()).toBeUndefined();
  });

  it("should return context within runWithAuthContext", () => {
    runWithAuthContext(mockContext, () => {
      const ctx = getAuthContext();
      expect(ctx).toBeDefined();
      expect(ctx?.authenticated).toBe(true);
      expect(ctx?.scopes).toEqual(["read", "write"]);
    });
  });

  it("should return undefined outside runWithAuthContext", () => {
    runWithAuthContext(mockContext, () => {
      // Inside — should exist
      expect(getAuthContext()).toBeDefined();
    });
    // Outside — should not exist
    expect(getAuthContext()).toBeUndefined();
  });

  it("should isolate contexts between runs", () => {
    const otherContext: AuthenticatedContext = {
      authenticated: true,
      scopes: ["admin"],
    };

    runWithAuthContext(mockContext, () => {
      expect(getAuthContext()?.scopes).toEqual(["read", "write"]);

      runWithAuthContext(otherContext, () => {
        expect(getAuthContext()?.scopes).toEqual(["admin"]);
      });

      // Outer context should be restored
      expect(getAuthContext()?.scopes).toEqual(["read", "write"]);
    });
  });

  it("should work with async callbacks", async () => {
    await runWithAuthContext(mockContext, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(getAuthContext()?.authenticated).toBe(true);
    });
  });
});
