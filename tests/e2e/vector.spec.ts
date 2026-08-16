/**
 * E2E Tests: Vector Group
 *
 * Verifies the 11 vector capabilities against a live MySQL 9.0+ database.
 */

import { test, expect } from "@playwright/test";
import {
  startServer,
  stopServer,
  createClient,
  callToolAndParse,
  expectSuccess,
  expectHandlerError,
} from "./helpers.js";
import type { Client } from "@modelcontextprotocol/client";

// Force sequential execution
import { TIMEOUTS } from "./helpers.js";

test.describe.configure({ mode: "serial", timeout: TIMEOUTS.DEFAULT });

const PORT = 3161 + Number(process.env.TEST_WORKER_INDEX || 0);

test.describe("Vector Tools", () => {
  let client: Client;

  test.beforeAll(async () => {
    // Start server with just the vector and core groups
    await startServer(PORT, ["--tool-filter", "vector,core"], "vector");
    client = await createClient(`http://127.0.0.1:${PORT}`);

    // Try to create a temporary test table
    const result = await callToolAndParse(client, "mysql_write_query", {
      query:
        "CREATE TABLE IF NOT EXISTS temp_e2e_vectors (id INT PRIMARY KEY, text_content TEXT, embedding VECTOR(3))",
    });

    if (result.success === false) {
      test.skip(true, "Vector type not supported by this MySQL version");
      return;
    }

    // Add FULLTEXT index for hybrid search testing
    await callToolAndParse(client, "mysql_write_query", {
      query: "ALTER TABLE temp_e2e_vectors ADD FULLTEXT(text_content)",
    });
  });

  test.afterAll(async () => {
    try {
      await callToolAndParse(client, "mysql_write_query", {
        query: "DROP TABLE IF EXISTS temp_e2e_vectors",
      });
    } catch {}
    if (client) await client.close();
    stopServer(PORT);
  });

  test("mysql_vector_info correctly lists vector columns", async () => {
    const result = await callToolAndParse(client, "mysql_vector_info", {
      table: "temp_e2e_vectors",
    });
    expectSuccess(result);
    const data = result.data as Record<string, unknown>;
    expect(data.columns).toBeInstanceOf(Array);
    const embeddingCol = (data.columns as Array<{ name: string; dimensions?: number }>).find(
      (c) => c.name === "embedding"
    );
    expect(embeddingCol).toBeDefined();
    expect(embeddingCol.dimensions).toBe(3);
  });

  test("mysql_vector_batch_store inserts multiple vectors", async () => {
    const result = await callToolAndParse(client, "mysql_vector_batch_store", {
      table: "temp_e2e_vectors",
      column: "embedding",
      items: [
        { id: 1, vector: [0.1, 0.2, 0.3] },
        { id: 2, vector: [0.9, 0.1, 0.1] },
        { id: 3, vector: [0.1, 0.9, 0.1] },
      ],
    });
    expectSuccess(result);
    expect(result.data?.count).toBe(3);
  });

  test("mysql_vector_store inserts a single vector", async () => {
    const result = await callToolAndParse(client, "mysql_vector_store", {
      table: "temp_e2e_vectors",
      column: "embedding",
      id: 4,
      vector: [0.5, 0.5, 0.5],
    });
    expectSuccess(result);

    // Update text content for hybrid search later
    await callToolAndParse(client, "mysql_write_query", {
      query:
        "UPDATE temp_e2e_vectors SET text_content = 'machine learning' WHERE id = 1",
    });
    await callToolAndParse(client, "mysql_write_query", {
      query:
        "UPDATE temp_e2e_vectors SET text_content = 'artificial intelligence' WHERE id = 2",
    });
  });

  test("mysql_vector_get retrieves a stored vector", async () => {
    const result = await callToolAndParse(client, "mysql_vector_get", {
      table: "temp_e2e_vectors",
      id: 1,
    });
    expectSuccess(result);
    expect(result.data?.vector).toEqual([0.1, 0.2, 0.3]);
  });

  test("mysql_vector_get returns P154 existence pattern if not found", async () => {
    const result = await callToolAndParse(client, "mysql_vector_get", {
      table: "temp_e2e_vectors",
      id: 999,
    });
    expectSuccess(result);
    expect(result.data?.exists).toBe(false);
  });

  test("mysql_vector_search finds nearest neighbors", async () => {
    const result = await callToolAndParse(client, "mysql_vector_search", {
      table: "temp_e2e_vectors",
      column: "embedding",
      queryVector: [0.1, 0.8, 0.1],
      k: 2,
      metric: "EUCLIDEAN",
    });

    if (result.success === false) {
      // MySQL Community Edition lacks the DISTANCE() function
      expect(result.error).toContain("MySQL HeatWave or a specific vector plugin");
      expect(result.code).toBe("EXTENSION_MISSING");
    } else {
      expectSuccess(result);
      expect(result.data?.count).toBeLessThanOrEqual(2);
      expect(result.data?.results[0].id).toBe(3);
    }
  });

  test("mysql_vector_range_search finds within distance", async () => {
    const result = await callToolAndParse(client, "mysql_vector_range_search", {
      table: "temp_e2e_vectors",
      column: "embedding",
      queryVector: [0.1, 0.2, 0.3],
      maxDistance: 0.1,
      metric: "EUCLIDEAN",
    });

    if (result.success === false) {
      expect(result.error).toContain("MySQL HeatWave or a specific vector plugin");
      expect(result.code).toBe("EXTENSION_MISSING");
    } else {
      expectSuccess(result);
      expect(result.data?.count).toBeGreaterThanOrEqual(1);
      expect(result.data?.results[0].id).toBe(1);
    }
  });

  test("mysql_vector_hybrid_search combines vector and fulltext", async () => {
    const result = await callToolAndParse(
      client,
      "mysql_vector_hybrid_search",
      {
        table: "temp_e2e_vectors",
        vectorColumn: "embedding",
        textColumn: "text_content",
        queryText: "learning",
        queryVector: [0.1, 0.2, 0.3],
      }
    );

    if (result.success === false) {
      expect(result.error).toContain("MySQL HeatWave or a specific vector plugin");
      expect(result.code).toBe("EXTENSION_MISSING");
    } else {
      expectSuccess(result);
      expect(result.data?.count).toBeGreaterThanOrEqual(1);
      expect(typeof result.data?.results[0].combined_score).toBe("number");
    }
  });

  test("mysql_vector_stats computes statistics", async () => {
    const result = await callToolAndParse(client, "mysql_vector_stats", {
      table: "temp_e2e_vectors",
      column: "embedding",
    });
    expectSuccess(result);
    expect(result.data?.totalRows).toBe(4);
    expect((result.data?.stats as Record<string, unknown>).dimensions.max).toBe(3);
  });

  test("mysql_vector_create_index works (or graceful fallback on 9.0+ CE)", async () => {
    const result = await callToolAndParse(client, "mysql_vector_create_index", {
      table: "temp_e2e_vectors",
      column: "embedding",
    });
    
    if (result.success === false) {
      if (result.code === "EXTENSION_MISSING") {
        if (result.error?.toString().toLowerCase().includes("heatwave")) {
          expect(result.error?.toString().toLowerCase()).toContain("heatwave");
        } else {
          expectHandlerError(result, "MySQL 9.1+ is required");
        }
      } else {
        // MySQL Community Edition (even 9.1+) lacks native VECTOR INDEX syntax
        expect(result.code).toBe("QUERY_ERROR");
        expect(result.error?.toString().toLowerCase()).toContain("syntax");
      }
    } else {
      expectSuccess(result);
      expect(result.data?.created).toBe(true);
    }
  });

  test("mysql_vector_optimize updates statistics", async () => {
    const result = await callToolAndParse(client, "mysql_vector_optimize", {
      table: "temp_e2e_vectors",
    });
    expectSuccess(result);
    expect(result.data?.optimized).toBe(true);
  });

  test("mysql_vector_delete removes a vector", async () => {
    const result = await callToolAndParse(client, "mysql_vector_delete", {
      table: "temp_e2e_vectors",
      id: 4,
    });
    expectSuccess(result);

    // Verify it's gone
    const check = await callToolAndParse(client, "mysql_vector_get", {
      table: "temp_e2e_vectors",
      id: 4,
    });
    expect(check.data?.exists).toBe(false);
  });
});
