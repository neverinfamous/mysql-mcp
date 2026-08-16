import mysql from "mysql2/promise";
import type { ProxySQLConfig } from "../../schemas/proxysql.js";
import { execSync } from "node:child_process";

export const LIKE_SAFE_RE = /^[a-zA-Z0-9_%\-. *]+$/;

export function getProxySQLConfig(): ProxySQLConfig {
  return {
    host: process.env["PROXYSQL_HOST"] ?? "localhost",
    port: parseInt(process.env["PROXYSQL_PORT"] ?? "6032", 10),
    user: process.env["PROXYSQL_USER"] ?? "admin",
    password: process.env["PROXYSQL_PASSWORD"] ?? "admin",
  };
}

export async function proxySQLQuery(
  sql: string,
  config?: ProxySQLConfig,
): Promise<Record<string, unknown>[]> {
  const cfg = config ?? getProxySQLConfig();

  const attemptHosts = [cfg.host];

  // Windows native WSL fallback: If host is localhost/127.0.0.1 and we are on Windows,
  // we may encounter ECONNREFUSED due to WSL2 port forwarding issues.
  if (
    process.platform === "win32" &&
    (cfg.host === "127.0.0.1" || cfg.host === "localhost")
  ) {
    try {
      const output = execSync("wsl hostname -I", { encoding: "utf8" });
      const ip = output.trim().split(/\s+/)[0];
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        attemptHosts.push(ip);
      }
    } catch {
      // Ignore error if wsl is not available
    }
  }

  let lastError: unknown;

  for (const host of attemptHosts) {
    let connection;
    try {
      connection = await mysql.createConnection({
        host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
      });

      const [rows] = await connection.query(sql);
      const validRows: Record<string, unknown>[] = [];
      if (Array.isArray(rows)) {
        for (const r of rows) {
          if (typeof r === "object" && r !== null) {
            const rec: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(r)) {
              rec[k] = v;
            }
            validRows.push(rec);
          }
        }
      }
      return validRows;
    } catch (error) {
      lastError = error;
      // Continue to the next host
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  throw lastError;
}

const SENSITIVE_VARIABLE_PATTERNS = [/password/i, /credentials/i];

export function redactSensitiveVariables(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  return rows.map((row) => {
    const varName =
      typeof row["variable_name"] === "string" ? row["variable_name"] : "";
    const isSensitive = SENSITIVE_VARIABLE_PATTERNS.some((p) =>
      p.test(varName),
    );
    if (isSensitive) {
      return { ...row, variable_value: "********" };
    }
    return row;
  });
}
