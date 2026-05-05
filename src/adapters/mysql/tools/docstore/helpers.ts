import type { MySQLAdapter } from "../../mysql-adapter.js";

export const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// Valid JSON path: $, $.field, $.field.sub, $.field[0], $[0], $[*]
export const JSON_PATH_RE =
  /^(\$)((\.([a-zA-Z_][a-zA-Z0-9_]*))|((\[\d+\])|(\[\*\])))*$/;

/**
 * Parse filter string into a WHERE clause.
 * Supports:
 * - JSON path existence: $.name, $.address.city
 * - _id match: direct _id value (32-char hex string)
 * - Field equality: name=Alice, age=30
 */
export function parseDocFilter(filter: string): {
  where: string;
  params: unknown[];
} {
  // Check if it's a direct _id (32-char hex)
  if (/^[a-f0-9]{32}$/i.test(filter)) {
    return { where: "_id = ?", params: [filter] };
  }

  // Check if it's a stringified JSON object (e.g. from criteria: {"name":"Alice"})
  if (filter.trim().startsWith("{") && filter.trim().endsWith("}")) {
    try {
      const parsed = JSON.parse(filter) as unknown;
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        const keys = Object.keys(record);
        const field = keys[0];
        if (typeof field === "string") {
          const value = record[field];
          if (IDENTIFIER_RE.test(field)) {
            const numVal = Number(value);
            if (typeof value === "number" || (typeof value === "string" && !isNaN(numVal) && value.trim() !== "")) {
              return {
                where: `JSON_UNQUOTE(JSON_EXTRACT(doc, ?)) = ?`,
                params: [`$.${field}`, String(numVal)],
              };
            }
            return {
              where: `JSON_UNQUOTE(JSON_EXTRACT(doc, ?)) = ?`,
              params: [`$.${field}`, String(value)],
            };
          }
        }
      }
    } catch {
      // Ignore parse error and fall through
    }
  }

  // Check for simple field=value pattern
  const eqMatch = /^([a-zA-Z_][a-zA-Z0-9_]*)=(.+)$/.exec(filter);
  if (eqMatch) {
    const field = eqMatch[1] ?? "";
    const value = eqMatch[2] ?? "";
    // Defense-in-depth: validate field name against identifier regex
    if (!IDENTIFIER_RE.test(field)) {
      throw new Error(
        `Invalid field name in filter: "${field}". Field names must be valid identifiers.`,
      );
    }
    // Try to parse as number
    const numVal = Number(value);
    if (!isNaN(numVal)) {
      return {
        where: `JSON_UNQUOTE(JSON_EXTRACT(doc, ?)) = ?`,
        params: [`$.${field}`, String(numVal)],
      };
    }
    return {
      where: `JSON_UNQUOTE(JSON_EXTRACT(doc, ?)) = ?`,
      params: [`$.${field}`, value],
    };
  }

  // Default: treat as JSON path existence check
  if (!filter.startsWith("$")) {
    throw new Error(
      `Invalid filter: "${filter}". Use JSON path ($.field), _id value, or field=value format.`,
    );
  }
  // Validate JSON path against allowlist regex to prevent injection
  if (!JSON_PATH_RE.test(filter)) {
    throw new Error(
      `Invalid JSON path: "${filter}". Only alphanumeric field names, array indices, and dot notation are allowed.`,
    );
  }
  return { where: `JSON_EXTRACT(doc, ?) IS NOT NULL`, params: [filter] };
}

/**
 * Check if a collection (table) exists in the specified (or current) database.
 * Returns a discriminated result distinguishing schema-not-found from collection-not-found.
 */
export async function checkCollectionExists(
  adapter: MySQLAdapter,
  collection: string,
  schema?: string,
): Promise<
  | { exists: true }
  | { exists: false; reason: "schema" | "collection"; name: string }
> {
  // When schema is explicitly provided, check schema existence first
  if (schema) {
    const schemaCheck = await adapter.executeQuery(
      "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
      [schema],
    );
    if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
      return { exists: false, reason: "schema", name: schema };
    }
  }
  const result = await adapter.executeQuery(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = COALESCE(?, DATABASE()) AND TABLE_NAME = ?`,
    [schema ?? null, collection],
  );
  if ((result.rows?.length ?? 0) > 0) {
    return { exists: true };
  }
  return { exists: false, reason: "collection", name: collection };
}

/**
 * Build a backtick-escaped qualified table reference.
 */
export function escapeTableRef(name: string, schema?: string): string {
  return schema ? `\`${schema}\`.\`${name}\`` : `\`${name}\``;
}
