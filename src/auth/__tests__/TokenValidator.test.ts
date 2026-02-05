/**
 * mysql-mcp - TokenValidator Unit Tests
 *
 * Tests for JWT token validation.
 *
 * Note: These tests focus on the TokenValidator class interface.
 * Full JWT validation testing would require mocking the jose library.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TokenValidator, createTokenValidator } from "../TokenValidator.js";

// Mock jose library for comprehensive testing
vi.mock("jose", async () => {
  const original = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...original,
    createRemoteJWKSet: vi.fn(() => vi.fn()),
    jwtVerify: vi.fn(),
  };
});

import * as jose from "jose";

describe("TokenValidator", () => {
  let validator: TokenValidator;

  beforeEach(() => {
    vi.clearAllMocks();
    validator = new TokenValidator({
      jwksUri: "https://auth.example.com/.well-known/jwks.json",
      issuer: "https://auth.example.com",
      audience: "mysql-mcp",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create validator with default config", () => {
    expect(validator).toBeDefined();
  });

  it("should have invalidateCache method", () => {
    expect(typeof validator.invalidateCache).toBe("function");
  });

  it("should have validate method", () => {
    expect(typeof validator.validate).toBe("function");
  });

  it("should work with all configuration options", () => {
    const validatorWithOptions = new TokenValidator({
      jwksUri: "https://auth.example.com/.well-known/jwks.json",
      issuer: "https://auth.example.com",
      audience: "mysql-mcp",
      clockTolerance: 120,
      jwksCacheTtl: 7200,
      algorithms: ["RS256", "ES256"],
    });
    expect(validatorWithOptions).toBeDefined();
  });

  it("should invalidate cache without error", () => {
    expect(() => validator.invalidateCache()).not.toThrow();
  });
});

describe("TokenValidator Validation", () => {
  let validator: TokenValidator;
  const mockJwtVerify = jose.jwtVerify as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    validator = new TokenValidator({
      jwksUri: "https://auth.example.com/.well-known/jwks.json",
      issuer: "https://auth.example.com",
      audience: "mysql-mcp",
    });
  });

  it("should validate token successfully with all claims", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: "user123",
        scope: "read write admin",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: "https://auth.example.com",
        aud: "mysql-mcp",
        nbf: Math.floor(Date.now() / 1000),
        jti: "unique-token-id",
        client_id: "my-client",
      },
    });

    const result = await validator.validate("header.payload.signature");

    expect(result.valid).toBe(true);
    expect(result.claims?.sub).toBe("user123");
    expect(result.claims?.scopes).toContain("read");
    expect(result.claims?.scopes).toContain("write");
    expect(result.claims?.client_id).toBe("my-client");
  });

  it("should handle token without optional claims", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      },
    });

    const result = await validator.validate("header.payload.signature");

    expect(result.valid).toBe(true);
    expect(result.claims?.sub).toBe("");
    expect(result.claims?.scopes).toEqual([]);
  });

  it("should return TOKEN_EXPIRED error for expired token", async () => {
    const expiredError = new jose.errors.JWTExpired(
      "Token has expired",
      {} as jose.JWTPayload,
    );
    mockJwtVerify.mockRejectedValue(expiredError);

    const result = await validator.validate("expired.token.here");

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("TOKEN_EXPIRED");
    expect(result.error).toContain("expired");
  });

  it("should return INVALID_SIGNATURE error for bad signature", async () => {
    const signatureError = new jose.errors.JWSSignatureVerificationFailed(
      "Signature verification failed",
    );
    mockJwtVerify.mockRejectedValue(signatureError);

    const result = await validator.validate("bad.signature.token");

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("INVALID_SIGNATURE");
    expect(result.error).toContain("signature");
  });

  it("should return INVALID_CLAIMS error for claim validation failure", async () => {
    const claimError = new jose.errors.JWTClaimValidationFailed(
      "audience mismatch",
      {} as jose.JWTPayload,
      "aud",
      "mismatch",
    );
    mockJwtVerify.mockRejectedValue(claimError);

    const result = await validator.validate("invalid.claims.token");

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("INVALID_CLAIMS");
    expect(result.error).toContain("Claim validation failed");
  });

  it("should return INVALID_TOKEN for generic errors", async () => {
    mockJwtVerify.mockRejectedValue(new Error("Something went wrong"));

    const result = await validator.validate("some.token.here");

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("INVALID_TOKEN");
    expect(result.error).toBe("Something went wrong");
  });

  it("should return INVALID_TOKEN for non-Error objects", async () => {
    mockJwtVerify.mockRejectedValue("string error");

    const result = await validator.validate("some.token.here");

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("INVALID_TOKEN");
    expect(result.error).toBe("Token validation failed");
  });
});

describe("TokenValidator JWKS Caching", () => {
  let validator: TokenValidator;
  const mockCreateRemoteJWKSet = jose.createRemoteJWKSet as ReturnType<
    typeof vi.fn
  >;
  const mockJwtVerify = jose.jwtVerify as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    validator = new TokenValidator({
      jwksUri: "https://auth.example.com/.well-known/jwks.json",
      issuer: "https://auth.example.com",
      audience: "mysql-mcp",
      jwksCacheTtl: 1, // 1 second for testing
    });
  });

  it("should use cached JWKS on subsequent calls", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: { sub: "user", exp: 9999999999, iat: 1 },
    });

    await validator.validate("token1");
    await validator.validate("token2");

    expect(mockCreateRemoteJWKSet).toHaveBeenCalledTimes(1);
  });

  it("should refresh JWKS after cache expires", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: { sub: "user", exp: 9999999999, iat: 1 },
    });

    await validator.validate("token1");

    // Invalidate cache manually
    validator.invalidateCache();

    await validator.validate("token2");

    expect(mockCreateRemoteJWKSet).toHaveBeenCalledTimes(2);
  });

  it("should throw JwksFetchError if JWKS creation fails", async () => {
    mockCreateRemoteJWKSet.mockImplementationOnce(() => {
      throw new Error("Network error");
    });

    // Invalidate to force fetch
    validator.invalidateCache();

    // Should return invalid result with error message because getJWKS error is caught
    const result = await validator.validate("token");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Failed to fetch JWKS");
  });
});

describe("TokenValidator Configuration", () => {
  it("should accept all configuration options", () => {
    const validator = new TokenValidator({
      jwksUri: "https://auth.example.com/.well-known/jwks.json",
      issuer: "https://auth.example.com",
      audience: "mysql-mcp",
      clockTolerance: 30,
    });
    expect(validator).toBeDefined();
  });

  it("should work with required configuration", () => {
    const validator = new TokenValidator({
      jwksUri: "https://auth.example.com/.well-known/jwks.json",
      issuer: "https://auth.example.com",
      audience: "test-audience",
    });
    expect(validator).toBeDefined();
  });
});

describe("createTokenValidator", () => {
  it("should create TokenValidator instance", () => {
    const validator = createTokenValidator({
      jwksUri: "https://auth.example.com/.well-known/jwks.json",
      issuer: "https://auth.example.com",
      audience: "mysql-mcp",
    });

    expect(validator).toBeInstanceOf(TokenValidator);
  });
});

describe("OAuth Security Edge Cases", () => {
  let validator: TokenValidator;
  const mockJwtVerify = jose.jwtVerify as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    validator = new TokenValidator({
      jwksUri: "https://auth.example.com/.well-known/jwks.json",
      issuer: "https://auth.example.com",
      audience: "mysql-mcp",
      clockTolerance: 30, // 30 seconds tolerance
    });
  });

  it("should reject token with modified signature (INVALID_SIGNATURE)", async () => {
    // Simulates an attacker modifying the token payload and signature
    const signatureError = new jose.errors.JWSSignatureVerificationFailed(
      "Signature verification failed - possible tampering",
    );
    mockJwtVerify.mockRejectedValue(signatureError);

    const result = await validator.validate("modified.payload.badsig");

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("INVALID_SIGNATURE");
    // Verify no sensitive data is leaked in error
    expect(result.error).not.toContain("secret");
    expect(result.error).not.toContain("key");
  });

  it("should reject token with future nbf (not before) claim", async () => {
    // Token not yet valid - nbf is in the future
    const claimError = new jose.errors.JWTClaimValidationFailed(
      "Token is not yet valid (nbf)",
      { nbf: Math.floor(Date.now() / 1000) + 3600 } as jose.JWTPayload,
      "nbf",
      "check_failed",
    );
    mockJwtVerify.mockRejectedValue(claimError);

    const result = await validator.validate("future.nbf.token");

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("INVALID_CLAIMS");
  });

  it("should reject severely expired token even with high clock tolerance", async () => {
    // Token expired way beyond any reasonable clock tolerance
    const expiredError = new jose.errors.JWTExpired(
      "Token expired 24 hours ago",
      {} as jose.JWTPayload,
    );
    mockJwtVerify.mockRejectedValue(expiredError);

    const result = await validator.validate("very.expired.token");

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("TOKEN_EXPIRED");
  });

  it("should not leak JWKS URI in error messages", async () => {
    mockJwtVerify.mockRejectedValue(new Error("Failed to fetch JWKS"));

    const result = await validator.validate("any.token.here");

    expect(result.valid).toBe(false);
    // Ensure JWKS URI isn't exposed
    expect(result.error).not.toContain("well-known");
    expect(result.error).not.toContain("jwks");
  });

  it("should not leak issuer details in claim mismatch errors", async () => {
    const claimError = new jose.errors.JWTClaimValidationFailed(
      'unexpected "iss" claim value',
      { iss: "https://attacker.com" } as jose.JWTPayload,
      "iss",
      "mismatch",
    );
    mockJwtVerify.mockRejectedValue(claimError);

    const result = await validator.validate("wrong.issuer.token");

    expect(result.valid).toBe(false);
    // Error should be generic, not revealing expected issuer
    expect(result.error).not.toContain("auth.example.com");
  });
});
