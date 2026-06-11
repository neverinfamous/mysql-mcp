import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import { ExtensionNotAvailableError, ValidationError } from "../../../../types/modules/errors.js";

/**
 * Get MySQL server version
 */
export async function getServerVersion(adapter: MySQLAdapter): Promise<{ major: number; minor: number; patch: number; raw: string }> {
  const result = await adapter.executeQuery("SELECT VERSION() as version");
  let rawVersion = "0.0.0";
  
  if (result?.rows !== undefined && result.rows.length > 0) {
    const firstRow = result.rows[0];
    if (firstRow !== undefined && firstRow !== null) {
      const row = firstRow;
      const versionStr = row['version'];
      if (typeof versionStr === 'string') {
        rawVersion = versionStr;
      }
    }
  }

  const baseStr = rawVersion.split("-")[0] || "0.0.0";
  const parts = baseStr.split(".");
  return {
    major: parseInt(parts[0] || "0", 10),
    minor: parseInt(parts[1] || "0", 10),
    patch: parseInt(parts[2] || "0", 10),
    raw: rawVersion,
  };
}

/**
 * Ensures MySQL version is 9.0+
 */
export async function ensureVectorSupport(adapter: MySQLAdapter): Promise<void> {
  const version = await getServerVersion(adapter);
  if (version.major < 9) {
    throw new ExtensionNotAvailableError(
      `MySQL 9.0+ is required for vector operations (current: ${version.raw})`
    );
  }
}

/**
 * Ensures MySQL version is 9.1+ (required for VECTOR INDEX)
 */
export async function ensureVectorIndexSupport(adapter: MySQLAdapter): Promise<void> {
  const version = await getServerVersion(adapter);
  if (version.major < 9 || (version.major === 9 && version.minor < 1)) {
    throw new ExtensionNotAvailableError(
      `MySQL 9.1+ is required for VECTOR INDEX (current: ${version.raw})`
    );
  }
}

/**
 * Formats a number array into a MySQL STRING_TO_VECTOR compatible string
 */
export function formatVector(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

/**
 * Parses a MySQL VECTOR_TO_STRING output back into a number array
 */
export function parseVector(vectorStr: string): number[] {
  if (!vectorStr || !vectorStr.startsWith("[") || !vectorStr.endsWith("]")) {
    throw new ValidationError("Invalid vector format returned from database");
  }
  
  const content = vectorStr.slice(1, -1).trim();
  if (!content) return [];
  
  return content.split(",").map((num) => {
    const parsed = parseFloat(num.trim());
    if (isNaN(parsed)) throw new ValidationError("Invalid number in vector string");
    return parsed;
  });
}

/**
 * Helper to escape identifiers safely
 */
export function sanitizeIdentifier(id: string): string {
  return id
    .split(".")
    .map((part) => part.replace(/`/g, ""))
    .join(".");
}
