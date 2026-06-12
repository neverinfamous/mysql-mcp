import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SystemDb } from "./system-db.js";
import fs from "fs";
import path from "path";

describe("SystemDb", () => {
  const dbPath = path.join(process.cwd(), "test-system.sqlite");

  beforeEach(() => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
    if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
  });

  afterEach(() => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
    if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
  });

  it("should initialize database and create tables", async () => {
    const db = new SystemDb({ dbPath });
    await db.init();
    
    expect(fs.existsSync(dbPath)).toBe(true);
    db.close();
  });

  it("should save and load metrics snapshots via getDb()", async () => {
    const db = new SystemDb({ dbPath });
    await db.init();

    const sqliteDb = db.getDb();
    
    // Insert dummy record
    const stmt = sqliteDb.prepare(`
      INSERT INTO metrics_snapshots (timestamp, tool, calls, errors, p50, p95, p99, tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(new Date().toISOString(), "test_tool", 5, 1, 20, 30, 40, 500);

    // Verify record
    const row = sqliteDb.prepare("SELECT * FROM metrics_snapshots WHERE tool = ?").get("test_tool") as { tool: string; calls: number; errors: number; tokens: number };
    
    expect(row).toBeDefined();
    expect(row.tool).toBe("test_tool");
    expect(row.calls).toBe(5);

    db.close();
  });

  it("should gracefully handle missing better-sqlite3 or uninitialized state", async () => {
    const db = new SystemDb({ dbPath });
    // Don't call init()
    expect(() => db.close()).not.toThrow();
  });
});
