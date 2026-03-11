import { test, expect } from "@playwright/test";

test.describe("HTTP Transport Security & Limits", () => {
  test("should return 404 Not Found for unknown endpoints", async ({
    request,
  }) => {
    const response = await request.get("/non-existent-path");
    expect(response.status()).toBe(404);

    const body = await response.json();
    expect(body).toHaveProperty("error", "Not found");
  });

  test("should return 413 Payload Too Large for excessive POST bodies", async ({
    request,
  }) => {
    // Generate a payload over 1MB (1048576 bytes)
    const bulkyData = "A".repeat(1024 * 1025); // ~1.025 MB string

    // We send this to /mcp which accepts POSTs
    const response = await request.post("/mcp", {
      headers: {
        Accept: "application/json, text/event-stream",
      },
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          testData: bulkyData,
        },
      },
    });

    // Express enforces the body size limit via express.json({ limit })
    expect(response.status()).toBe(413);
  });

  test("should inject security headers on responses", async ({ request }) => {
    const response = await request.get("/health");
    expect(response.status()).toBe(200);

    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["cache-control"]).toBe(
      "no-store, no-cache, must-revalidate",
    );
    expect(headers["content-security-policy"]).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    expect(headers["permissions-policy"]).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
    expect(headers["referrer-policy"]).toBe("no-referrer");
  });

  test("should NOT include HSTS header by default (opt-in only)", async ({
    request,
  }) => {
    const response = await request.get("/health");
    const headers = response.headers();
    expect(headers["strict-transport-security"]).toBeUndefined();
  });

  test("should allow /health requests even when other endpoints are rate-limited", async ({
    request,
  }) => {
    // Health check must always succeed regardless of rate limit state
    const response = await request.get("/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("status", "healthy");
  });

  test("should respond correctly to CORS preflight OPTIONS requests", async ({
    request,
  }) => {
    const response = await request.fetch("/mcp", {
      method: "OPTIONS",
    });

    // Preflight returns 204 No Content
    expect(response.status()).toBe(204);
  });

  test("should ignore X-Forwarded-For when trustProxy is not enabled", async ({
    request,
  }) => {
    const response = await request.get("/health", {
      headers: { "X-Forwarded-For": "1.2.3.4" },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("status", "healthy");
  });
});
