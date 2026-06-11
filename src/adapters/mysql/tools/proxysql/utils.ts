import mysql from "mysql2/promise";
import type { ProxySQLConfig } from "../../schemas/proxysql.js";

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

  const connection = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
  });

  try {
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
  } finally {
    await connection.end();
  }
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
