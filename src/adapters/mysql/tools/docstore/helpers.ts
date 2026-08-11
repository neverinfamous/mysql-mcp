import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import { ValidationError } from "../../../../types/modules/errors.js";

export const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

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
      const parsed: unknown = JSON.parse(filter);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        const keys = Object.keys(parsed);
        if (keys.length > 0) {
          const conditions: string[] = [];
          const params: unknown[] = [];
          for (const field of keys) {
            const value = (parsed as Record<string, unknown>)[field];
            if (!IDENTIFIER_RE.test(field)) {
              throw new ValidationError(`Invalid field name in filter: "${field}". Field names must be valid identifiers.`);
            }
            const numVal = Number(value);
            if (
              typeof value === "number" ||
              (typeof value === "string" &&
                !isNaN(numVal) &&
                value.trim() !== "")
            ) {
              conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(doc, ?)) = ?`);
              params.push(`$.${field}`, String(numVal));
            } else {
              conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(doc, ?)) = ?`);
              params.push(`$.${field}`, String(value));
            }
          }
          return {
            where: conditions.join(" AND "),
            params,
          };
        }
      }
    } catch (e) {
      if (e instanceof ValidationError) throw e;
      // Ignore parse error and fall through
    }
  }

  // Check for simple field=value pattern (prevent matching ==, ===)
  const eqMatch = /^(?:\$\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?!=)\s*(.+)$/.exec(filter);
  if (eqMatch) {
    const field = eqMatch[1] ?? "";
    let value = eqMatch[2] ?? "";
    
    // Strip surrounding quotes if present
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    
    // Defense-in-depth: validate field name against identifier regex
    if (!IDENTIFIER_RE.test(field)) {
      throw new ValidationError(
        `Invalid field name in filter: "${field}". Field names must be valid identifiers.`,
      );
    }
    // Try to parse as number
    const numVal = Number(value);
    if (!isNaN(numVal) && value.trim() !== "") {
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
    if (/[><!]=?|==/.test(filter)) {
      throw new ValidationError(
        `Invalid filter: "${filter}". Only equality (field=value), exact _id match, or JSON path existence are supported.`,
      );
    }
    return {
      where: `JSON_UNQUOTE(JSON_EXTRACT(doc, ?)) = ?`,
      params: [`$._id`, filter],
    };
  }
  // Validate JSON path against allowlist regex to prevent injection
  if (!JSON_PATH_RE.test(filter)) {
    throw new ValidationError(
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
  | { exists: false; reason: "schema" | "collection" | "not_a_collection"; name: string }
> {
  if (schema) {
    const schemaCheck = await adapter.executeQuery(
      `SHOW SCHEMAS LIKE '${schema}'`
    );
    if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
      return { exists: false, reason: "schema", name: schema };
    }
  }


  const tableRef = escapeTableRef(collection, schema);
  try {
    const result = await adapter.executeQuery(`SHOW COLUMNS FROM ${tableRef}`);
    if (!result.rows || result.rows.length === 0) {
      return { exists: false, reason: "collection", name: collection };
    }
    
    let hasDoc = false;
    let hasId = false;
    for (const row of result.rows) {
      if (typeof row === 'object' && row !== null) {
        const field = row['Field'] as string;
        const type = (row['Type'] as string)?.toLowerCase();
        if (field === 'doc' && type === 'json') {
          hasDoc = true;
        }
        if (field === '_id') {
          hasId = true;
        }
      }
    }
    
    if (hasDoc && hasId) {
      return { exists: true };
    }
    return { exists: false, reason: "not_a_collection", name: collection };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("doesn't exist") || message.toLowerCase().includes("unknown table")) {
      return { exists: false, reason: "collection", name: collection };
    }
    throw error;
  }
}

/**
 * Build a backtick-escaped qualified table reference.
 */
export function escapeTableRef(name: string, schema?: string): string {
  const escapedName = name.replace(/`/g, '``');
  const escapedSchema = schema ? schema.replace(/`/g, '``') : undefined;
  return escapedSchema ? `\`${escapedSchema}\`.\`${escapedName}\`` : `\`${escapedName}\``;
}
