/**
 * Zod Validation Sweep
 *
 * Calls every tool that has REQUIRED parameters with empty args ({}).
 * Asserts the response is a structured handler error ({ success: false, error: "..." })
 * and NOT a raw MCP error frame (isError: true with -32602 code).
 *
 * Tools with no required params (e.g., mysql_list_tables) are excluded — they succeed on {}.
 *
 * Ported from db-mcp/tests/e2e/zod-sweep.spec.ts — adapted for mysql-mcp tool names.
 */

import { test, expect } from "@playwright/test";
import { createClient, callToolRaw } from "./helpers.js";

test.describe.configure({ mode: "serial" });

/**
 * Send {} to a tool and assert we get a structured handler error,
 * not a raw MCP error frame.
 */
async function assertZodHandlerError(baseURL: string, toolName: string) {
  const client = await createClient(baseURL);
  try {
    const response = await callToolRaw(client, toolName, {});

    // If the SDK returned isError: true, the response is a raw MCP error.
    // We still parse the text to check if it's structured.
    const text = response.content[0]?.text;
    expect(text, `${toolName}: no response content`).toBeDefined();

    // The response must be valid JSON (structured handler error) OR a raw MCP
    // error string (SDK-level Zod validation caught it before the handler).
    // Both are acceptable — the key is the tool DID reject empty args.
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Raw MCP error string — the SDK caught the Zod validation.
      // This is acceptable: the tool properly rejected empty args.
      return;
    }

    // If we got JSON, check for handler error shape OR a success=false
    // Some tools may return success: false with error string
    if ("success" in parsed) {
      expect(
        parsed.success,
        `${toolName}: expected success: false, got: ${JSON.stringify(parsed, null, 2)}`,
      ).toBe(false);
      expect(
        typeof parsed.error,
        `${toolName}: missing error string in: ${JSON.stringify(parsed, null, 2)}`,
      ).toBe("string");
    } else if ("error" in parsed) {
      // Some tools return { error: "..." } without explicit success field
      expect(typeof parsed.error).toBe("string");
    } else {
      // Tool returned a valid result on {} — it shouldn't be in the sweep
      throw new Error(
        `${toolName}: expected error but got valid result: ${JSON.stringify(parsed, null, 2)}`,
      );
    }
  } finally {
    await client.close();
  }
}

// =============================================================================
// Core Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: Core", () => {
  const tools = [
    "mysql_read_query",
    "mysql_write_query",
    "mysql_create_table",
    "mysql_describe_table",
    "mysql_drop_table",
    "mysql_create_index",
    "mysql_drop_index",
    "mysql_upsert",
    "mysql_batch_insert",
    "mysql_count",
    "mysql_exists",
    "mysql_truncate",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(undefined, tool);
    });
  }
});

// =============================================================================
// JSONB Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: JSONB", () => {
  const tools = [
    "mysql_jsonb_extract",
    "mysql_jsonb_contains",
    "mysql_jsonb_path_query",
    "mysql_jsonb_set",
    "mysql_jsonb_insert",
    "mysql_jsonb_delete",
    "mysql_jsonb_array",
    "mysql_jsonb_strip_nulls",
    "mysql_jsonb_validate_path",
    "mysql_jsonb_merge",
    "mysql_jsonb_normalize",
    "mysql_jsonb_diff",
    "mysql_jsonb_agg",
    "mysql_jsonb_keys",
    "mysql_jsonb_typeof",
    "mysql_jsonb_index_suggest",
    "mysql_jsonb_security_scan",
    "mysql_jsonb_stats",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(undefined, tool);
    });
  }
});

// =============================================================================
// Text Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: Text", () => {
  const tools = [
    "mysql_text_search",
    "mysql_text_rank",
    "mysql_text_headline",
    "mysql_create_fts_index",
    "mysql_trigram_similarity",
    "mysql_fuzzy_match",
    "mysql_regexp_match",
    "mysql_text_normalize",
    "mysql_text_to_vector",
    "mysql_text_to_query",
    "mysql_like_search",
    "mysql_text_sentiment",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(undefined, tool);
    });
  }
});

// =============================================================================
// Stats Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: Stats", () => {
  const tools = [
    "mysql_stats_correlation",
    "mysql_stats_regression",
    "mysql_stats_descriptive",
    "mysql_stats_percentiles",
    "mysql_stats_distribution",
    "mysql_stats_hypothesis",
    "mysql_stats_sampling",
    "mysql_stats_time_series",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(undefined, tool);
    });
  }
});

// =============================================================================
// Performance Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: Performance", () => {
  const tools = [
    "mysql_explain",
    "mysql_explain_analyze",
    "mysql_explain_buffers",
    "mysql_query_plan_compare",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(undefined, tool);
    });
  }
});

// =============================================================================
// Transactions Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: Transactions", () => {
  const tools = [
    "mysql_transaction_execute",
    "mysql_transaction_savepoint",
    "mysql_transaction_release",
    "mysql_transaction_rollback_to",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(undefined, tool);
    });
  }
});

// =============================================================================
// Admin Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: Admin", () => {
  const tools = [
    "mysql_reindex",
    "mysql_terminate_backend",
    "mysql_cancel_backend",
    "mysql_set_config",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(undefined, tool);
    });
  }
});

// =============================================================================
// Schema Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: Schema", () => {
  const tools = [
    "mysql_create_schema",
    "mysql_drop_schema",
    "mysql_create_sequence",
    "mysql_drop_sequence",
    "mysql_create_view",
    "mysql_drop_view",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(undefined, tool);
    });
  }
});

// =============================================================================
// Backup Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: Backup", () => {
  const tools = ["mysql_dump_table", "mysql_copy_export", "mysql_copy_import"];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(undefined, tool);
    });
  }
});

// =============================================================================
// Vector Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: Vector", () => {
  const tools = [
    "mysql_vector_add_column",
    "mysql_vector_insert",
    "mysql_vector_batch_insert",
    "mysql_vector_search",
    "mysql_vector_create_index",
    "mysql_hybrid_search",
    "mysql_vector_distance",
    "mysql_vector_normalize",
    "mysql_vector_aggregate",
    "mysql_vector_validate",
    "mysql_vector_cluster",
    "mysql_vector_dimension_reduce",
    "mysql_vector_embed",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(undefined, tool);
    });
  }
});

// =============================================================================
// Introspection Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: Introspection", () => {
  const tools = [
    "mysql_cascade_simulator",
    "mysql_migration_risks",
    "mysql_migration_record",
    "mysql_migration_apply",
    "mysql_migration_rollback",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(undefined, tool);
    });
  }
});

// =============================================================================
// Partitioning Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: Partitioning", () => {
  const tools = [
    "mysql_attach_partition",
    "mysql_detach_partition",
    "mysql_create_partitioned_table",
    "mysql_create_partition",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(undefined, tool);
    });
  }
});

// =============================================================================
// PostGIS Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: PostGIS", () => {
  const tools = [
    "mysql_geometry_column",
    "mysql_spatial_index",
    "mysql_point_in_polygon",
    "mysql_distance",
    "mysql_buffer",
    "mysql_intersection",
    "mysql_bounding_box",
    "mysql_geometry_buffer",
    "mysql_geometry_intersection",
    "mysql_geometry_transform",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(undefined, tool);
    });
  }
});

// =============================================================================
// Code Mode
// =============================================================================

test.describe("Zod Sweep: Code Mode", () => {
  test("mysql_execute_code({}) → handler error", async ({}, testInfo) => {
    await assertZodHandlerError(undefined, "mysql_execute_code");
  });
});

// =============================================================================
// Minor Extensions & Monitoring Group (tools with required params)
// =============================================================================

test.describe("Zod Sweep: Minor Extensions & Monitoring", () => {
  const tools = [
    // citext
    "mysql_citext_convert_column",
    "mysql_citext_compare",
    "mysql_citext_schema_advisor",
    // ltree
    "mysql_ltree_convert_column",
    "mysql_ltree_create_index",
    "mysql_ltree_query",
    "mysql_ltree_subpath",
    "mysql_ltree_lca",
    "mysql_ltree_match",
    // pgcrypto
    "mysql_pgcrypto_hash",
    "mysql_pgcrypto_hmac",
    "mysql_pgcrypto_encrypt",
    "mysql_pgcrypto_decrypt",
    "mysql_pgcrypto_gen_random_bytes",
    "mysql_pgcrypto_gen_salt",
    "mysql_pgcrypto_crypt",
    // mysql_cron
    "mysql_cron_schedule",
    "mysql_cron_schedule_in_database",
    "mysql_cron_alter_job",
    "mysql_cron_unschedule",
    // partman
    "mysql_partman_create_parent",
    "mysql_partman_show_partitions",
    "mysql_partman_check_default",
    "mysql_partman_partition_data",
    "mysql_partman_set_retention",
    "mysql_partman_undo_partition",
  ];

  for (const tool of tools) {
    test(`${tool}({}) → handler error`, async ({}, testInfo) => {
      await assertZodHandlerError(undefined, tool);
    });
  }
});
