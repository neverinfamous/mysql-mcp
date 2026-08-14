import https from "node:https";
import http from "node:http";
import { execSync } from "node:child_process";
import type { RouterConfig, ErrorResponse } from "../../../../types/index.js";
import { MySQLMcpError } from "../../../../types/modules/errors.js";
import { formatHandlerErrorResponse } from "../core/error-helpers.js";

export type SafeRouterResult<T> =
  | { success: true; data: T }
  | { success: false; response: ErrorResponse };

export function getRouterConfig(): RouterConfig {
  return {
    url: process.env["MYSQL_ROUTER_URL"] ?? "https://localhost:8443",
    username: process.env["MYSQL_ROUTER_USER"] ?? "",
    password: process.env["MYSQL_ROUTER_PASSWORD"] ?? "",
    insecure: process.env["MYSQL_ROUTER_INSECURE"] === "true",
    apiVersion: process.env["MYSQL_ROUTER_API_VERSION"] ?? "/api/20190715",
  };
}

export async function routerFetch(
  path: string,
  config?: RouterConfig,
): Promise<unknown> {
  const cfg = config ?? getRouterConfig();
  const baseUrl = cfg.url ?? "https://localhost:8443";
  const apiVersion = cfg.apiVersion ?? "/api/20190715";
  const username = cfg.username ?? "";
  const password = cfg.password ?? "";
  const insecure = cfg.insecure ?? false;

  const attemptUrls = [baseUrl];

  // Windows native WSL fallback: If host is localhost/127.0.0.1 and we are on Windows,
  // we may encounter ECONNREFUSED due to WSL2 port forwarding issues.
  if (process.platform === "win32") {
    try {
      const parsedUrl = new URL(baseUrl);
      if (parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "localhost") {
        const output = execSync("wsl hostname -I", { encoding: "utf8" });
        const ip = output.trim().split(/\s+/)[0];
        if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
          parsedUrl.hostname = ip;
          attemptUrls.push(parsedUrl.toString().replace(/\/$/, ""));
        }
      }
    } catch {
      // Ignore error if wsl is not available
    }
  }

  let lastError: unknown;

  for (const url of attemptUrls) {
    try {
      const fullUrl = `${url}${apiVersion}${path}`;
      const parsedUrl = new URL(fullUrl);

      const result = await new Promise((resolve, reject) => {
        const headers: Record<string, string> = {
          Accept: "application/json",
        };

        if (username && password) {
          const auth = Buffer.from(`${username}:${password}`).toString("base64");
          headers["Authorization"] = `Basic ${auth}`;
        }

        const requestOptions: https.RequestOptions = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 8443,
          path: parsedUrl.pathname,
          method: "GET",
          headers,
          timeout: 10000,
        };

        if (parsedUrl.protocol === "https:") {
          requestOptions.rejectUnauthorized = !insecure;
        }

        const client = parsedUrl.protocol === "https:" ? https : http;
        const req = client.request(requestOptions, (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            const statusCode = res.statusCode ?? 0;
            if (statusCode >= 200 && statusCode < 300) {
              try {
                resolve(JSON.parse(data));
              } catch {
                reject(new Error(`Invalid JSON response: ${data}`));
              }
            } else {
              let errorDetail = "";
              let parsedData: unknown;
              try {
                if (data) {
                  parsedData = JSON.parse(data);
                  errorDetail = JSON.stringify(parsedData);
                }
              } catch {
                errorDetail = data.substring(0, 100);
              }
              const err = new Error(
                `Router API error: ${statusCode} ${res.statusMessage ?? "Unknown"}${errorDetail ? ` - ${errorDetail}` : ""}`,
              );
              Object.assign(err, { statusCode });
              if (parsedData !== undefined) {
                Object.assign(err, { responseData: parsedData });
              }
              reject(err);
            }
          });
        });

        req.on("error", (error) => {
          const errorCode =
            error instanceof Error && "code" in error && typeof error.code === "string"
              ? error.code
              : undefined;
          let message = error instanceof Error ? error.message : String(error);
          if (errorCode === "ECONNREFUSED" || message.includes("ECONNREFUSED")) {
            message = `Connection refused - MySQL Router REST API is not reachable at ${url}`;
          } else if (errorCode === "ETIMEDOUT" || errorCode === "ESOCKETTIMEDOUT" || message.includes("ETIMEDOUT")) {
            message = `Connection timed out - MySQL Router REST API at ${url} is not responding`;
          } else if (errorCode === "ENOTFOUND" || message.includes("ENOTFOUND")) {
            message = `Host not found - cannot resolve ${parsedUrl.hostname}`;
          } else if (errorCode === "ECONNRESET" || message.includes("ECONNRESET")) {
            message = `Connection reset - MySQL Router REST API at ${url} forcefully closed the connection`;
          } else if (
            errorCode === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
            errorCode === "CERT_HAS_EXPIRED" ||
            errorCode === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
            message.includes("self-signed") ||
            message.includes("certificate")
          ) {
            message = `TLS certificate error: ${message}. Set MYSQL_ROUTER_INSECURE=true for self-signed certificates`;
          }
          reject(new Error(`Router API request failed: ${message}`));
        });

        req.on("timeout", () => {
          req.destroy();
          reject(
            new Error(
              `Router API request timed out after 10 seconds - MySQL Router at ${url} is not responding`,
            ),
          );
        });

        req.end();
      });

      return result;
    } catch (error) {
      lastError = error;
      // Continue to the next URL
    }
  }

  throw lastError;
}

export async function safeRouterFetch(path: string): Promise<SafeRouterResult<unknown>> {
  try {
    const data = await routerFetch(path);
    return { success: true, data };
  } catch (error) {
    const statusCode =
      error !== null && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number"
        ? error.statusCode
        : undefined;
    const responseData =
      error !== null && typeof error === "object" && "responseData" in error
        ? error.responseData
        : undefined;

    if (statusCode === 404) {
      let msg = "Resource not found";
      const matchRoute = /^\/routes\/([^/]+)/.exec(path);
      const route = matchRoute?.[1];
      if (route) msg = `Route '${decodeURIComponent(route)}' not found`;
      
      const matchPool = /^\/connection_pool\/([^/]+)/.exec(path);
      const pool = matchPool?.[1];
      if (pool) msg = `Connection pool '${decodeURIComponent(pool)}' not found`;

      const matchMetadata = /^\/metadata\/([^/]+)/.exec(path);
      const metadata = matchMetadata?.[1];
      if (metadata) msg = `Metadata cache '${decodeURIComponent(metadata)}' not found`;

      return {
        success: false,
        response: formatHandlerErrorResponse(
          new MySQLMcpError(msg, "NOT_FOUND_ERROR", "resource")
        ),
      };
    }

    if (statusCode === 401) {
      return {
        success: false,
        response: formatHandlerErrorResponse(
          new MySQLMcpError(
            "Router API authentication failed. Verify MYSQL_ROUTER_USER and MYSQL_ROUTER_PASSWORD.",
            "AUTHENTICATION_ERROR",
            "authentication",
            { suggestion: "Set correct credentials for the MySQL Router REST API." }
          )
        ),
      };
    }

    if (
      statusCode === 500 &&
      responseData !== undefined &&
      responseData !== null &&
      typeof responseData === "object" &&
      typeof Reflect.get(responseData, "isAlive") === "boolean"
    ) {
      return { success: true, data: responseData };
    }

    return {
      success: false,
      response: formatHandlerErrorResponse(error),
    };
  }
}
