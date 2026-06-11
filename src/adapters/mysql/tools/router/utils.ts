import https from "node:https";
import type { RouterConfig, ErrorResponse } from "../../../../types/index.js";
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

  const fullUrl = `${baseUrl}${apiVersion}${path}`;
  const parsedUrl = new URL(fullUrl);

  return new Promise((resolve, reject) => {
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
      rejectUnauthorized: !insecure,
      timeout: 10000,
    };

    const req = https.request(requestOptions, (res) => {
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
              parsedData = JSON.parse(data) as unknown;
              errorDetail = JSON.stringify(parsedData);
            }
          } catch {
            errorDetail = data.substring(0, 100);
          }
          const err = new Error(
            `Router API error: ${statusCode} ${res.statusMessage ?? "Unknown"}${errorDetail ? ` - ${errorDetail}` : ""}`,
          );
          const extendedErr = err as Error & {
            statusCode: number;
            responseData?: unknown;
          };
          extendedErr.statusCode = statusCode;
          if (parsedData !== undefined) {
            extendedErr.responseData = parsedData;
          }
          reject(extendedErr);
        }
      });
    });

    req.on("error", (error) => {
      const errorCode = (error as NodeJS.ErrnoException).code;
      let message = error.message;
      if (errorCode === "ECONNREFUSED") {
        message = `Connection refused - MySQL Router REST API is not reachable at ${baseUrl}`;
      } else if (errorCode === "ETIMEDOUT" || errorCode === "ESOCKETTIMEDOUT") {
        message = `Connection timed out - MySQL Router REST API at ${baseUrl} is not responding`;
      } else if (errorCode === "ENOTFOUND") {
        message = `Host not found - cannot resolve ${parsedUrl.hostname}`;
      } else if (
        errorCode === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
        errorCode === "CERT_HAS_EXPIRED" ||
        errorCode === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
        error.message.includes("self-signed") ||
        error.message.includes("certificate")
      ) {
        message = `TLS certificate error: ${error.message}. Set MYSQL_ROUTER_INSECURE=true for self-signed certificates`;
      }
      reject(new Error(`Router API request failed: ${message}`));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(
        new Error(
          `Router API request timed out after 10 seconds - MySQL Router at ${baseUrl} is not responding`,
        ),
      );
    });

    req.end();
  });
}

export async function safeRouterFetch<T>(path: string): Promise<SafeRouterResult<T>> {
  try {
    const data = (await routerFetch(path)) as T;
    return { success: true, data };
  } catch (error) {
    const extendedErr = error as Error & {
      statusCode?: number;
      responseData?: unknown;
    };

    if (extendedErr.statusCode === 404) {
      return {
        success: false,
        response: formatHandlerErrorResponse(error),
      };
    }

    const resData = extendedErr.responseData as
      | Record<string, unknown>
      | undefined;
    if (
      extendedErr.statusCode === 500 &&
      resData !== undefined &&
      resData !== null &&
      typeof resData === "object" &&
      typeof resData["isAlive"] === "boolean"
    ) {
      return { success: true, data: resData as T };
    }

    return {
      success: false,
      response: formatHandlerErrorResponse(error),
    };
  }
}
