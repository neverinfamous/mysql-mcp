/**
 * mysql-mcp - Input Validators
 * 
 * Centralized input validation utilities for SQL security.
 */

/**
 * Validation error for security-related input issues
 */
export class ValidationError extends Error {
    constructor(message: string, public readonly field: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

/**
 * Valid MySQL identifier pattern
 * - Must start with letter or underscore
 * - Can contain letters, numbers, underscores
 * - Max length 64 characters (MySQL limit)
 */
const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

/**
 * Extended identifier pattern allowing dots for schema.table format
 */
const QUALIFIED_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}(\.[a-zA-Z_][a-zA-Z0-9_]{0,63})?$/;

/**
 * Dangerous patterns in WHERE clauses that indicate SQL injection attempts
 */
const DANGEROUS_WHERE_PATTERNS = [
    // Stacked queries - semicolon followed by SQL keyword
    /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE)\b/i,
    // SQL comments that could hide malicious code
    /--\s*$/m,
    /\/\*[\s\S]*?\*\//,
    // Query manipulation keywords (usually not in WHERE)
    /\bUNION\s+(ALL\s+)?SELECT\b/i,
    /\bEXCEPT\s+SELECT\b/i,
    /\bINTERSECT\s+SELECT\b/i,
    // Dangerous functions
    /\bINTO\s+(OUTFILE|DUMPFILE)\b/i,
    /\bLOAD_FILE\s*\(/i,
    // Information schema probing (common in attacks)
    /\bINFORMATION_SCHEMA\b.*\bTABLES\b/i,
    // Benchmark/sleep (timing attacks)
    /\bBENCHMARK\s*\(/i,
    /\bSLEEP\s*\(/i,
];

/**
 * Validate a SQL identifier (table name, column name, schema name)
 * 
 * @param name - The identifier to validate
 * @param type - Type of identifier for error messages
 * @throws ValidationError if identifier is invalid
 */
export function validateIdentifier(
    name: string,
    type: 'table' | 'column' | 'schema' | 'database' | 'index' | 'view' | 'event' | 'procedure' | 'function' = 'table'
): void {
    if (!name || typeof name !== 'string') {
        throw new ValidationError(`${type} name must be a non-empty string`, type);
    }

    if (name.length > 64) {
        throw new ValidationError(`${type} name exceeds maximum length of 64 characters`, type);
    }

    if (!IDENTIFIER_PATTERN.test(name)) {
        throw new ValidationError(
            `Invalid ${type} name: must start with letter/underscore and contain only alphanumeric characters`,
            type
        );
    }
}

/**
 * Validate a qualified identifier (e.g., schema.table)
 * 
 * @param name - The qualified identifier to validate
 * @param type - Type of identifier for error messages
 * @throws ValidationError if identifier is invalid
 */
export function validateQualifiedIdentifier(
    name: string,
    type: 'table' | 'column' | 'view' = 'table'
): void {
    if (!name || typeof name !== 'string') {
        throw new ValidationError(`${type} name must be a non-empty string`, type);
    }

    if (!QUALIFIED_IDENTIFIER_PATTERN.test(name)) {
        throw new ValidationError(
            `Invalid ${type} name: must be alphanumeric with optional schema prefix (schema.name)`,
            type
        );
    }
}

/**
 * Escape a SQL identifier for safe inclusion in queries
 * 
 * @param name - The identifier to escape
 * @returns Escaped identifier (backticks escaped)
 */
export function escapeIdentifier(name: string): string {
    // Replace backticks with double backticks (MySQL escaping)
    return name.replace(/`/g, '``');
}

/**
 * Validate a WHERE clause for dangerous SQL injection patterns
 * 
 * This performs pattern-based detection of common SQL injection attempts.
 * It allows legitimate complex WHERE clauses while blocking known attack patterns.
 * 
 * @param where - The WHERE clause to validate (without the WHERE keyword)
 * @throws ValidationError if dangerous patterns are detected
 */
export function validateWhereClause(where: string | undefined): void {
    if (where === undefined || where === null || typeof where !== 'string') {
        return; // Empty/null WHERE is valid (will be skipped)
    }

    const trimmed = where.trim();
    if (trimmed.length === 0) {
        return;
    }

    for (const pattern of DANGEROUS_WHERE_PATTERNS) {
        if (pattern.test(trimmed)) {
            throw new ValidationError(
                'WHERE clause contains potentially dangerous SQL patterns',
                'where'
            );
        }
    }

    // Check for unbalanced quotes (sign of injection attempt)
    // Note: escaped quotes ('') count as 2, so we check odd counts
    // after removing escaped quotes
    const unescapedSingles = trimmed.replace(/''/g, '').match(/'/g);
    const unescapedDoubles = trimmed.replace(/""/g, '').match(/"/g);

    if ((unescapedSingles?.length ?? 0) % 2 !== 0) {
        throw new ValidationError(
            'WHERE clause contains unbalanced single quotes',
            'where'
        );
    }

    if ((unescapedDoubles?.length ?? 0) % 2 !== 0) {
        throw new ValidationError(
            'WHERE clause contains unbalanced double quotes',
            'where'
        );
    }
}

/**
 * Validate a LIKE pattern for safe usage
 * Already used in monitoring.ts, but centralized here for consistency
 * 
 * @param pattern - The LIKE pattern to escape
 * @returns Escaped pattern safe for SQL
 */
export function escapeLikePattern(pattern: string): string {
    // Escape single quotes for selected text
    return pattern.replace(/'/g, "''");
}

/**
 * Escape a potentially qualified table name
 * Handles "table" -> "`table`" and "db.table" -> "`db`.`table`"
 */
export function escapeQualifiedTable(table: string): string {
    return table.split('.').map(part => `\`${part.replace(/`/g, '``')}\``).join('.');
}
