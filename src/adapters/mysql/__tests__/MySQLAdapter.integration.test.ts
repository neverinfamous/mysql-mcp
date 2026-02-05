import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MySQLAdapter } from "../MySQLAdapter.js";

describe("MySQLAdapter Integration", () => {
  let adapter: MySQLAdapter;

  // Credentials from docker-compose.yml
  const config = {
    type: "mysql" as const,
    host: "localhost", // Or host.docker.internal if running inside docker, but vitest runs on host
    port: 3306,
    username: "root",
    password: "root",
    database: "testdb",
  };

  beforeAll(async () => {
    adapter = new MySQLAdapter();
    try {
      await adapter.connect(config);
      console.log("Connected to MySQL Docker container");
    } catch (error) {
      console.warn(
        "Skipping integration tests: Could not connect to MySQL Docker container",
        error,
      );
      // Skip suite if connection fails (e.g. docker not running)
      return;
    }
  });

  afterAll(async () => {
    if (adapter && adapter.isConnected()) {
      await adapter.executeWriteQuery("DROP TABLE IF EXISTS integration_test");
      await adapter.disconnect();
    }
  });

  it("should create a test table", async () => {
    if (!adapter.isConnected()) return;

    await adapter.executeWriteQuery(`
            CREATE TABLE IF NOT EXISTS integration_test (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

    // Verify table exists
    const tables = await adapter.listTables();
    const found = tables.some((t) => t.name === "integration_test");
    expect(found).toBe(true);
  });

  it("should insert and retrieve data", async () => {
    if (!adapter.isConnected()) return;

    // Insert
    const insertResult = await adapter.executeWriteQuery(
      "INSERT INTO integration_test (name) VALUES (?)",
      ["test_item"],
    );
    expect(insertResult.rowsAffected).toBe(1);

    // Retrieve
    const selectResult = await adapter.executeReadQuery(
      "SELECT * FROM integration_test WHERE name = ?",
      ["test_item"],
    );
    expect(selectResult.rows).toBeDefined();
    expect(selectResult.rows).toHaveLength(1);
    expect((selectResult.rows![0] as any).name).toBe("test_item");
  });

  it("should handle transactions correctly", async () => {
    if (!adapter.isConnected()) return;

    // 1. Begin Transaction
    const txId = await adapter.beginTransaction();
    expect(txId).toBeDefined();

    // 2. Insert data within transaction
    await adapter.executeWriteQuery(
      "INSERT INTO integration_test (name) VALUES (?)",
      ["rollup_item"],
      txId, // Passed txId
    );

    // 3. Rollback
    await adapter.rollbackTransaction(txId);

    // 4. Verify data was NOT committed
    const result = await adapter.executeReadQuery(
      "SELECT * FROM integration_test WHERE name = ?",
      ["rollup_item"],
    );
    expect(result.rows).toHaveLength(0);
  });

  it("should commit transactions correctly", async () => {
    if (!adapter.isConnected()) return;

    // 1. Begin Transaction
    const txId = await adapter.beginTransaction();

    // 2. Insert data
    await adapter.executeWriteQuery(
      "INSERT INTO integration_test (name) VALUES (?)",
      ["commit_item"],
      txId, // Passed txId
    );

    // 3. Commit
    await adapter.commitTransaction(txId);

    // 4. Verify data WAS committed
    const result = await adapter.executeReadQuery(
      "SELECT * FROM integration_test WHERE name = ?",
      ["commit_item"],
    );
    expect(result.rows).toHaveLength(1);
  });

  it("should describe table metadata accurately", async () => {
    if (!adapter.isConnected()) return;

    const tableInfo = await adapter.describeTable("integration_test");

    expect(tableInfo.name).toBe("integration_test");
    expect(tableInfo.columns).toBeDefined();

    const nameCol = tableInfo.columns?.find((c) => c.name === "name");
    expect(nameCol).toBeDefined();
    expect(nameCol?.type).toContain("varchar");
  });

  it("should execute raw queries", async () => {
    if (!adapter.isConnected()) return;
    const result = await adapter.rawQuery('SHOW VARIABLES LIKE "version"');
    expect(result.rows).toBeDefined();
    expect(result.rows!.length).toBeGreaterThan(0);
  });

  it("should support transaction isolation levels", async () => {
    if (!adapter.isConnected()) return;
    const txId = await adapter.beginTransaction("READ COMMITTED");
    expect(txId).toBeDefined();
    await adapter.commitTransaction(txId);
  });

  it("should get full schema info", async () => {
    if (!adapter.isConnected()) return;
    const schema = await adapter.getSchema();
    expect(schema.tables).toBeDefined();
    expect(schema.tables.some((t) => t.name === "integration_test")).toBe(true);
  });
});
