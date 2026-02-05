/**
 * mysql-mcp - Middleware Unit Tests
 *
 * Tests for OAuth middleware utilities.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractBearerToken,
  formatOAuthError,
  validateAuth,
  createAuthContext,
  requireScope,
  requireAnyScope,
  requireToolScope,
  type AuthenticatedContext,
} from "../middleware.js";
import {
  TokenMissingError,
  InvalidTokenError,
  InsufficientScopeError,
} from "../errors.js";
import type { TokenValidator } from "../TokenValidator.js";

// Create mock token validator
function createMockTokenValidator(
  overrides: Partial<TokenValidator> = {},
): TokenValidator {
  return {
    validate: vi.fn().mockResolvedValue({
      valid: true,
      claims: { sub: "user1", scopes: ["read", "write"], exp: 0, iat: 0 },
    }),
    invalidateCache: vi.fn(),
    ...overrides,
  } as unknown as TokenValidator;
}

describe("extractBearerToken", () => {
  it("should extract token from valid Bearer header", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("should return null for undefined header", () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it("should return null for empty header", () => {
    expect(extractBearerToken("")).toBeNull();
  });

  it("should return null for non-Bearer auth", () => {
    expect(extractBearerToken("Basic abc123")).toBeNull();
  });

  it("should return null for malformed Bearer header", () => {
    expect(extractBearerToken("Bearer")).toBeNull();
  });

  it("should return empty string for Bearer with trailing space only", () => {
    // Note: 'Bearer ' (with trailing space) splits to ['bearer', ''] which returns ''
    expect(extractBearerToken("Bearer ")).toBe("");
  });

  it("should be case-insensitive for Bearer keyword", () => {
    expect(extractBearerToken("bearer abc123")).toBe("abc123");
    expect(extractBearerToken("BEARER abc123")).toBe("abc123");
  });
});

describe("formatOAuthError", () => {
  it("should format TokenMissingError as 401", () => {
    const result = formatOAuthError(new TokenMissingError());
    expect(result.status).toBe(401);
    expect(result.body).toHaveProperty("error", "invalid_token");
  });

  it("should format InvalidTokenError as 401", () => {
    const result = formatOAuthError(new InvalidTokenError("Token expired"));
    expect(result.status).toBe(401);
    expect(result.body).toHaveProperty("error", "invalid_token");
  });

  it("should format InsufficientScopeError as 403", () => {
    const result = formatOAuthError(
      new InsufficientScopeError(["admin", "write"]),
    );
    expect(result.status).toBe(403);
    expect(result.body).toHaveProperty("error", "insufficient_scope");
    expect(result.body).toHaveProperty("scope", "admin write");
  });

  it("should format unknown errors as 500", () => {
    const result = formatOAuthError(new Error("Something went wrong"));
    expect(result.status).toBe(500);
    expect(result.body).toHaveProperty("error", "server_error");
  });
});

describe("createAuthContext", () => {
  let mockValidator: TokenValidator;

  beforeEach(() => {
    mockValidator = createMockTokenValidator();
  });

  it("should return unauthenticated context when no token", async () => {
    const context = await createAuthContext(undefined, mockValidator);
    expect(context.authenticated).toBe(false);
    expect(context.scopes).toEqual([]);
  });

  it("should return authenticated context for valid token", async () => {
    const context = await createAuthContext("Bearer validtoken", mockValidator);
    expect(context.authenticated).toBe(true);
    expect(context.scopes).toEqual(["read", "write"]);
    expect(context.claims).toBeDefined();
  });

  it("should return unauthenticated context for invalid token", async () => {
    const invalidValidator = createMockTokenValidator({
      validate: vi
        .fn()
        .mockResolvedValue({ valid: false, error: "Invalid token" }),
    });

    const context = await createAuthContext(
      "Bearer invalidtoken",
      invalidValidator,
    );
    expect(context.authenticated).toBe(false);
    expect(context.scopes).toEqual([]);
  });
});

describe("validateAuth", () => {
  let mockValidator: TokenValidator;

  beforeEach(() => {
    mockValidator = createMockTokenValidator();
  });

  it("should throw TokenMissingError when no token and required", async () => {
    await expect(
      validateAuth(undefined, {
        tokenValidator: mockValidator,
        required: true,
      }),
    ).rejects.toThrow(TokenMissingError);
  });

  it("should return unauthenticated context when no token and not required", async () => {
    const context = await validateAuth(undefined, {
      tokenValidator: mockValidator,
      required: false,
    });
    expect(context.authenticated).toBe(false);
  });

  it("should throw InvalidTokenError for invalid token", async () => {
    const invalidValidator = createMockTokenValidator({
      validate: vi
        .fn()
        .mockResolvedValue({ valid: false, error: "Token expired" }),
    });

    await expect(
      validateAuth("Bearer expired", {
        tokenValidator: invalidValidator,
      }),
    ).rejects.toThrow(InvalidTokenError);
  });

  it("should return authenticated context for valid token", async () => {
    const context = await validateAuth("Bearer validtoken", {
      tokenValidator: mockValidator,
    });
    expect(context.authenticated).toBe(true);
    expect(context.scopes).toEqual(["read", "write"]);
  });

  it("should throw InsufficientScopeError when missing required scope", async () => {
    await expect(
      validateAuth("Bearer validtoken", {
        tokenValidator: mockValidator,
        requiredScopes: ["admin"], // User has read, write but not admin
      }),
    ).rejects.toThrow(InsufficientScopeError);
  });

  it("should pass when user has any of required scopes", async () => {
    const context = await validateAuth("Bearer validtoken", {
      tokenValidator: mockValidator,
      requiredScopes: ["read", "admin"], // User has read
    });
    expect(context.authenticated).toBe(true);
  });
});

describe("requireScope", () => {
  it("should throw TokenMissingError when not authenticated", () => {
    const context: AuthenticatedContext = { authenticated: false, scopes: [] };
    expect(() => requireScope(context, "read")).toThrow(TokenMissingError);
  });

  it("should throw InsufficientScopeError when scope missing", () => {
    const context: AuthenticatedContext = {
      authenticated: true,
      scopes: ["read"],
      claims: { sub: "user1", scopes: ["read"], exp: 0, iat: 0 },
    };
    expect(() => requireScope(context, "admin")).toThrow(
      InsufficientScopeError,
    );
  });

  it("should pass when scope is present", () => {
    const context: AuthenticatedContext = {
      authenticated: true,
      scopes: ["read", "write"],
      claims: { sub: "user1", scopes: ["read", "write"], exp: 0, iat: 0 },
    };
    expect(() => requireScope(context, "read")).not.toThrow();
  });
});

describe("requireAnyScope", () => {
  it("should throw TokenMissingError when not authenticated", () => {
    const context: AuthenticatedContext = { authenticated: false, scopes: [] };
    expect(() => requireAnyScope(context, ["read", "write"])).toThrow(
      TokenMissingError,
    );
  });

  it("should throw InsufficientScopeError when none of scopes present", () => {
    const context: AuthenticatedContext = {
      authenticated: true,
      scopes: ["read"],
      claims: { sub: "user1", scopes: ["read"], exp: 0, iat: 0 },
    };
    expect(() => requireAnyScope(context, ["admin", "superadmin"])).toThrow(
      InsufficientScopeError,
    );
  });

  it("should pass when any scope present", () => {
    const context: AuthenticatedContext = {
      authenticated: true,
      scopes: ["read", "write"],
      claims: { sub: "user1", scopes: ["read", "write"], exp: 0, iat: 0 },
    };
    expect(() => requireAnyScope(context, ["write", "admin"])).not.toThrow();
  });
});

describe("requireToolScope", () => {
  it("should throw TokenMissingError when not authenticated", () => {
    const context: AuthenticatedContext = { authenticated: false, scopes: [] };
    expect(() => requireToolScope(context, ["read"])).toThrow(
      TokenMissingError,
    );
  });

  it("should map read scope and pass", () => {
    const context: AuthenticatedContext = {
      authenticated: true,
      scopes: ["read"], // hasScope checks for 'read' directly
      claims: { sub: "user1", scopes: ["read"], exp: 0, iat: 0 },
    };
    expect(() => requireToolScope(context, ["read"])).not.toThrow();
  });

  it("should map write scope and pass", () => {
    const context: AuthenticatedContext = {
      authenticated: true,
      scopes: ["write"],
      claims: { sub: "user1", scopes: ["write"], exp: 0, iat: 0 },
    };
    expect(() => requireToolScope(context, ["write"])).not.toThrow();
  });

  it("should map admin scope and pass", () => {
    const context: AuthenticatedContext = {
      authenticated: true,
      scopes: ["admin"],
      claims: { sub: "user1", scopes: ["admin"], exp: 0, iat: 0 },
    };
    expect(() => requireToolScope(context, ["admin"])).not.toThrow();
  });

  it("should throw InsufficientScopeError when mapped scope missing", () => {
    const context: AuthenticatedContext = {
      authenticated: true,
      scopes: ["read"],
      claims: { sub: "user1", scopes: ["read"], exp: 0, iat: 0 },
    };
    expect(() => requireToolScope(context, ["admin"])).toThrow(
      InsufficientScopeError,
    );
  });

  it("should pass when user has admin scope and read is required", () => {
    const context: AuthenticatedContext = {
      authenticated: true,
      scopes: ["admin"], // admin includes read and write scopes
      claims: { sub: "user1", scopes: ["admin"], exp: 0, iat: 0 },
    };
    expect(() => requireToolScope(context, ["read"])).not.toThrow();
  });
});
