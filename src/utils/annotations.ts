/**
 * Tool Annotations Presets
 *
 * Reusable annotation configurations for common tool behavior patterns.
 * Used by all tool definition files for consistency.
 */

import type { ToolAnnotations } from "../types/index.js";

// =============================================================================
// Base Annotation Presets
// =============================================================================

/** Read-only query tools (SELECT, EXPLAIN, metadata retrieval) */
export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
};

/** Standard write tools (INSERT, UPDATE, CREATE) */
export const WRITE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
};

/** Destructive tools (DELETE, DROP, TRUNCATE) */
export const DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: false,
};

/** Idempotent tools (CREATE IF NOT EXISTS, upserts) */
export const IDEMPOTENT: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

/** Admin/maintenance tools (VACUUM, ANALYZE, REINDEX) */
export const ADMIN: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
};

// Helper functions omitted because `title` is part of ToolDefinition, not ToolAnnotations in mysql-mcp.
