import { ValidationError } from "../../types/index.js";
import {
  DANGEROUS_QUERY_PATTERNS,
  READ_ONLY_KEYWORDS,
  WRITE_KEYWORDS,
} from "./constants.js";

const WRITE_KEYWORD_SET: ReadonlySet<string> = new Set(WRITE_KEYWORDS);

/**
 * Reserved write/DDL/DCL keywords that can never appear at parenthesis depth 0
 * in a valid read-only WITH (CTE) or EXPLAIN ANALYZE query.
 */
const TOP_LEVEL_WRITE_KEYWORDS: ReadonlySet<string> = new Set([
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "CREATE",
  "ALTER",
  "TRUNCATE",
  "REPLACE",
  "GRANT",
  "REVOKE",
  "RENAME",
  "LOAD",
  "CALL",
  "HANDLER",
  "PREPARE",
  "EXECUTE",
  "DEALLOCATE",
  "LOCK",
  "UNLOCK",
  "FLUSH",
  "RESET",
  "PURGE",
  "KILL",
  "SHUTDOWN",
  "INSTALL",
  "UNINSTALL",
]);

/**
 * Unwrap MySQL (`/*! ... *\/`, `/*!50000 ... *\/`) and MariaDB (`/*M! ... *\/`)
 * executable comments so inner SQL tokens cannot bypass validation.
 */
function unwrapExecutableComments(sql: string): string {
  let current = sql;
  let iterations = 0;
  const execCommentPattern = /\/\*M?![0-9]*([\s\S]*?)\*\//gi;

  while (execCommentPattern.test(current) && iterations < 10) {
    current = current.replace(execCommentPattern, " $1 ");
    execCommentPattern.lastIndex = 0;
    iterations++;
  }

  // Reject unclosed or deeply nested executable comments
  if (/\/\*M?!/i.test(current)) {
    throw new ValidationError("Query contains potentially dangerous patterns");
  }

  return current;
}

/**
 * Strip all leading whitespace and SQL comments (`--`, `#`, `/* ... *\/`),
 * after unwrapping MySQL/MariaDB executable comments.
 */
export function stripLeadingSqlComments(sql: string): string {
  let remaining = unwrapExecutableComments(sql);

  while (remaining.length > 0) {
    const trimmed = remaining.replace(/^\s+/, "");
    if (trimmed !== remaining) {
      remaining = trimmed;
      continue;
    }

    if (remaining.startsWith("--")) {
      remaining = remaining.replace(/^--[^\r\n]*(?:\r?\n|$)/, "");
      continue;
    }

    if (remaining.startsWith("#")) {
      remaining = remaining.replace(/^#[^\r\n]*(?:\r?\n|$)/, "");
      continue;
    }

    if (remaining.startsWith("/*")) {
      const closeIdx = remaining.indexOf("*/", 2);
      if (closeIdx === -1) {
        throw new ValidationError(
          "Query contains potentially dangerous patterns",
        );
      }
      remaining = remaining.slice(closeIdx + 2);
      continue;
    }

    break;
  }

  return remaining;
}

/**
 * Strip comments (`--`, `#`, `/* ... *\/`) and replace quoted literals/identifiers
 * with neutral placeholders so lexical keyword analysis cannot be tricked by
 * comments or string contents.
 */
function sanitizeSqlForTokenAnalysis(sql: string): string {
  const unwrapped = unwrapExecutableComments(sql);
  let out = "";
  let i = 0;
  const len = unwrapped.length;

  while (i < len) {
    const ch = unwrapped[i];
    const next = unwrapped[i + 1];

    // Single-quoted or double-quoted string literal
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      while (i < len) {
        const c = unwrapped[i];
        if (c === "\\") {
          i += 2;
          continue;
        }
        if (c === quote) {
          if (unwrapped[i + 1] === quote) {
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      out += " '__STR__' ";
      continue;
    }

    // Backtick-quoted identifier
    if (ch === "`") {
      i++;
      while (i < len) {
        if (unwrapped[i] === "`") {
          if (unwrapped[i + 1] === "`") {
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      out += " `__ID__` ";
      continue;
    }

    // Line comment: --
    if (ch === "-" && next === "-") {
      i += 2;
      while (i < len && unwrapped[i] !== "\n" && unwrapped[i] !== "\r") {
        i++;
      }
      out += " ";
      continue;
    }

    // Line comment: #
    if (ch === "#") {
      i++;
      while (i < len && unwrapped[i] !== "\n" && unwrapped[i] !== "\r") {
        i++;
      }
      out += " ";
      continue;
    }

    // Block comment: /* ... */
    if (ch === "/" && next === "*") {
      const closeIdx = unwrapped.indexOf("*/", i + 2);
      if (closeIdx === -1) {
        throw new ValidationError(
          "Query contains potentially dangerous patterns",
        );
      }
      i = closeIdx + 2;
      out += " ";
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Extract uppercase word/symbol tokens at parenthesis depth 0 from sanitized SQL.
 */
function extractTopLevelTokens(sanitizedSql: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  const tokenRegex = /\(|\)|;|[A-Za-z_][A-Za-z0-9_]*|=/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(sanitizedSql)) !== null) {
    const tok = match[0];
    if (tok === "(") {
      depth++;
    } else if (tok === ")") {
      if (depth > 0) depth--;
    } else if (depth === 0) {
      tokens.push(tok.toUpperCase());
    }
  }

  return tokens;
}

/**
 * Validate query for safety (SQL injection prevention)
 * @param sql - SQL query to validate
 * @param isReadOnly - Whether to enforce read-only restrictions
 */
export function validateSqlSafety(sql: string, isReadOnly: boolean): void {
  if (!sql || typeof sql !== "string") {
    throw new ValidationError("Query must be a non-empty string");
  }

  const sanitizedSql = sanitizeSqlForTokenAnalysis(sql);
  const strippedLeading = stripLeadingSqlComments(sql);

  if (strippedLeading.length === 0) {
    throw new ValidationError("Query must be a non-empty string");
  }

  // Check for dangerous patterns on both raw and comment-stripped SQL
  for (const pattern of DANGEROUS_QUERY_PATTERNS) {
    if (pattern.test(sql) || pattern.test(sanitizedSql)) {
      throw new ValidationError(
        "Query contains potentially dangerous patterns",
      );
    }
  }

  // Enforce read-only restrictions
  if (isReadOnly) {
    const leadingStatement = strippedLeading.replace(/^[\s(]+/, "").toUpperCase();
    const firstWordMatch = /^([A-Z_]+)/.exec(leadingStatement);
    const firstKeyword = firstWordMatch?.[1] ?? "";

    if (WRITE_KEYWORD_SET.has(firstKeyword)) {
      throw new ValidationError(
        `Read-only mode: ${firstKeyword} statements are not allowed`,
      );
    }

    if (!firstKeyword || !READ_ONLY_KEYWORDS.has(firstKeyword)) {
      throw new ValidationError(
        `Read-only mode: ${firstKeyword || "unknown"} statements are not allowed`,
      );
    }

    const topLevelTokens = extractTopLevelTokens(sanitizedSql);

    // Reject multi-statement queries in read-only mode (any token after ';')
    const semiIdx = topLevelTokens.indexOf(";");
    if (semiIdx !== -1 && semiIdx < topLevelTokens.length - 1) {
      throw new ValidationError(
        "Query contains potentially dangerous patterns",
      );
    }

    // Inspect top-level tokens for CTE writes (WITH ... DELETE/UPDATE) and EXPLAIN ANALYZE writes
    if (firstKeyword === "WITH") {
      let hasReadTarget = false;
      for (const tok of topLevelTokens) {
        if (TOP_LEVEL_WRITE_KEYWORDS.has(tok)) {
          throw new ValidationError(
            `Read-only mode: ${tok} statements are not allowed`,
          );
        }
        if (tok === "SELECT" || tok === "TABLE" || tok === "VALUES") {
          hasReadTarget = true;
        }
      }
      if (!hasReadTarget) {
        throw new ValidationError(
          "Read-only mode: WITH statements must be followed by a SELECT query",
        );
      }
    } else if (firstKeyword === "EXPLAIN" && topLevelTokens.includes("ANALYZE")) {
      // EXPLAIN ANALYZE actually executes the target statement in MySQL 8.0.18+
      for (const tok of topLevelTokens) {
        if (TOP_LEVEL_WRITE_KEYWORDS.has(tok)) {
          throw new ValidationError(
            `Read-only mode: ${tok} statements are not allowed`,
          );
        }
      }
    }

    // Block locking reads and file exports in read-only mode
    if (
      /\bFOR\s+(?:UPDATE|SHARE)\b/i.test(sanitizedSql) ||
      /\bLOCK\s+IN\s+SHARE\s+MODE\b/i.test(sanitizedSql) ||
      /\bINTO\s+(?:OUTFILE|DUMPFILE)\b/i.test(sanitizedSql)
    ) {
      throw new ValidationError(
        "Read-only mode: locking or file export clauses are not allowed",
      );
    }
  }
}
