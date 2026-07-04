import { describe, it, expect } from "vitest";
import {
  defaultToEmpty,
  preprocessDatabaseParams,
  preprocessExecuteCodeParams,
  preprocessDocCollectionParams,
  preprocessTableParams,
  preprocessCheckVersionParams,
  preprocessIndexParams,
  preprocessConditionalUpdateParams,
  preprocessVectorParams,
  preprocessQueryParams,
  preprocessTransactionIdParams,
  preprocessSavepointParams,
  preprocessCreateTableParams,
  preprocessTransactionBeginParams,
  preprocessTransactionExecuteParams,
  preprocessJsonColumnParams,
  preprocessQueryOnlyParams,
  preprocessAdminTableParams,
  preprocessDocFilterParams,
  preprocessEventParams,
  preprocessDocIndexParams,
  preprocessBinlogEventsParams,
  preprocessSpatialParams,
  preprocessStatsParams
} from "../preprocess-utils.js";

describe("preprocess-utils", () => {
  describe("defaultToEmpty", () => {
    it("should return empty object for null/undefined", () => {
      expect(defaultToEmpty(null)).toEqual({});
      expect(defaultToEmpty(undefined)).toEqual({});
    });
    it("should return input otherwise", () => {
      expect(defaultToEmpty({ a: 1 })).toEqual({ a: 1 });
      expect(defaultToEmpty("test")).toEqual("test");
    });
  });

  describe("preprocessDatabaseParams", () => {
    it("should resolve db alias", () => {
      expect(preprocessDatabaseParams({ db: "test" })).toEqual({ db: "test", database: "test" });
    });
    it("should resolve schema alias", () => {
      expect(preprocessDatabaseParams({ schema: "test" })).toEqual({ schema: "test", database: "test" });
    });
    it("should not overwrite database", () => {
      expect(preprocessDatabaseParams({ database: "db1", db: "db2" })).toEqual({ database: "db1", db: "db2" });
    });
    it("should return primitive as is", () => {
      expect(preprocessDatabaseParams(null)).toBeNull();
      expect(preprocessDatabaseParams(123)).toBe(123);
    });
  });

  describe("preprocessExecuteCodeParams", () => {
    it("should resolve script/query/sql/javascript/js/command/execute/eval alias", () => {
      expect(preprocessExecuteCodeParams({ script: "s" })).toEqual({ script: "s", code: "s" });
      expect(preprocessExecuteCodeParams({ query: "s" })).toEqual({ query: "s", code: "s" });
      expect(preprocessExecuteCodeParams({ sql: "s" })).toEqual({ sql: "s", code: "s" });
      expect(preprocessExecuteCodeParams({ javascript: "s" })).toEqual({ javascript: "s", code: "s" });
      expect(preprocessExecuteCodeParams({ js: "s" })).toEqual({ js: "s", code: "s" });
      expect(preprocessExecuteCodeParams({ command: "s" })).toEqual({ command: "s", code: "s" });
      expect(preprocessExecuteCodeParams({ execute: "s" })).toEqual({ execute: "s", code: "s" });
      expect(preprocessExecuteCodeParams({ eval: "s" })).toEqual({ eval: "s", code: "s" });
    });
    it("should return empty object for null/undefined", () => {
      expect(preprocessExecuteCodeParams(null)).toEqual({});
    });
  });

  describe("preprocessDocCollectionParams", () => {
    it("should resolve aliases", () => {
      expect(preprocessDocCollectionParams({ collection: "c" })).toMatchObject({ name: "c", collection: "c" });
      expect(preprocessDocCollectionParams({ collectionName: "c" })).toMatchObject({ name: "c", collection: "c" });
      expect(preprocessDocCollectionParams({ table: "c" })).toMatchObject({ name: "c", collection: "c" });
      expect(preprocessDocCollectionParams({ tableName: "c" })).toMatchObject({ name: "c", collection: "c" });
      expect(preprocessDocCollectionParams({ tbl: "c" })).toMatchObject({ name: "c", collection: "c" });
    });
    it("should set schema from database", () => {
      expect(preprocessDocCollectionParams({ database: "d" })).toMatchObject({ database: "d", schema: "d" });
    });
    it("should convert document to documents array", () => {
      expect(preprocessDocCollectionParams({ document: { a: 1 } })).toMatchObject({ documents: [{ a: 1 }] });
      expect(preprocessDocCollectionParams({ document: [{ a: 1 }] })).toMatchObject({ documents: [{ a: 1 }] });
    });
  });

  describe("preprocessTableParams", () => {
    it("should resolve aliases", () => {
      expect(preprocessTableParams({ tableName: "t" })).toEqual({ tableName: "t", table: "t" });
      expect(preprocessTableParams({ name: "t" })).toEqual({ name: "t", table: "t" });
      expect(preprocessTableParams({ tbl: "t" })).toEqual({ tbl: "t", table: "t" });
      expect(preprocessTableParams({ table_name: "t" })).toEqual({ table_name: "t", table: "t" });
    });
  });

  describe("preprocessCheckVersionParams", () => {
    it("should resolve id to rowId", () => {
      expect(preprocessCheckVersionParams({ id: 1 })).toEqual({ id: 1, rowId: 1 });
    });
  });

  describe("preprocessIndexParams", () => {
    it("should resolve column to columns array", () => {
      expect(preprocessIndexParams({ column: "c1" })).toEqual({ column: "c1", columns: ["c1"] });
    });
    it("should convert string columns to array", () => {
      expect(preprocessIndexParams({ columns: "c1" })).toEqual({ columns: ["c1"] });
    });
  });

  describe("preprocessConditionalUpdateParams", () => {
    it("should flatten condition object to array", () => {
      expect(preprocessConditionalUpdateParams({ condition: { a: 1, b: 2 } })).toMatchObject({
        conditions: [{ column: "a", value: 1 }, { column: "b", value: 2 }]
      });
    });
    it("should preserve existing column/value format", () => {
      expect(preprocessConditionalUpdateParams({ conditions: { column: "a", value: 1 } })).toMatchObject({
        conditions: [{ column: "a", value: 1 }]
      });
    });
    it("should resolve version to expectedVersion", () => {
      expect(preprocessConditionalUpdateParams({ version: 1 })).toMatchObject({ expectedVersion: 1 });
    });
  });

  describe("preprocessVectorParams", () => {
    it("should resolve queryVector aliases", () => {
      expect(preprocessVectorParams({ vector: [1] })).toMatchObject({ queryVector: [1] });
      expect(preprocessVectorParams({ query: [1] })).toMatchObject({ queryVector: [1] });
      expect(preprocessVectorParams({ sql: [1] })).toMatchObject({ queryVector: [1] });
      expect(preprocessVectorParams({ search: [1] })).toMatchObject({ queryVector: [1] });
    });
    it("should resolve id aliases", () => {
      expect(preprocessVectorParams({ rowId: 1 })).toMatchObject({ id: 1 });
      expect(preprocessVectorParams({ recordId: 1 })).toMatchObject({ id: 1 });
    });
    it("should parse stringified JSON vector array", () => {
      expect(preprocessVectorParams({ vector: "[1,2,3]" })).toMatchObject({ vector: [1, 2, 3] });
      expect(preprocessVectorParams({ queryVector: "[1,2,3]" })).toMatchObject({ queryVector: [1, 2, 3] });
    });
    it("should drop invalid JSON vector string if not from input explicitly", () => {
      expect(preprocessVectorParams({ sql: "not json" })).toMatchObject({ queryText: "not json" });
    });
    it("should resolve maxDistance aliases", () => {
      expect(preprocessVectorParams({ distance: 1 })).toMatchObject({ maxDistance: 1 });
      expect(preprocessVectorParams({ radius: 1 })).toMatchObject({ maxDistance: 1 });
    });
    it("should uppercase metric", () => {
      expect(preprocessVectorParams({ metric: "l2" })).toMatchObject({ metric: "L2" });
    });
    it("should resolve idColumn, vectorColumn", () => {
      expect(preprocessVectorParams({ idCol: "i", col: "v" })).toMatchObject({ idColumn: "i", column: "v", vectorColumn: "v" });
      expect(preprocessVectorParams({ primaryKey: "i", vectorColumn: "v" })).toMatchObject({ idColumn: "i", vectorColumn: "v" });
    });
  });

  describe("preprocessQueryParams", () => {
    it("should resolve sql -> query", () => {
      expect(preprocessQueryParams({ sql: "s" })).toMatchObject({ query: "s" });
    });
    it("should resolve tx/txId -> transactionId", () => {
      expect(preprocessQueryParams({ tx: "1" })).toMatchObject({ transactionId: "1" });
      expect(preprocessQueryParams({ txId: "1" })).toMatchObject({ transactionId: "1" });
    });
  });

  describe("preprocessTransactionIdParams", () => {
    it("should resolve tx/txId -> transactionId", () => {
      expect(preprocessTransactionIdParams({ tx: "1" })).toMatchObject({ transactionId: "1" });
      expect(preprocessTransactionIdParams({ txId: "1" })).toMatchObject({ transactionId: "1" });
    });
  });

  describe("preprocessSavepointParams", () => {
    it("should resolve tx/txId -> transactionId", () => {
      expect(preprocessSavepointParams({ tx: "1" })).toMatchObject({ transactionId: "1" });
    });
    it("should resolve name/savepointName/id -> savepoint", () => {
      expect(preprocessSavepointParams({ name: "s" })).toMatchObject({ savepoint: "s" });
      expect(preprocessSavepointParams({ savepointName: "s" })).toMatchObject({ savepoint: "s" });
      expect(preprocessSavepointParams({ id: "s" })).toMatchObject({ savepoint: "s" });
    });
  });

  describe("preprocessCreateTableParams", () => {
    it("should resolve table/tableName -> name", () => {
      expect(preprocessCreateTableParams({ table: "t" })).toMatchObject({ name: "t" });
      expect(preprocessCreateTableParams({ tableName: "t" })).toMatchObject({ name: "t" });
    });
    it("should wrap string column into object array", () => {
      expect(preprocessCreateTableParams({ columns: "c1" })).toMatchObject({ columns: [{ name: "c1", type: "VARCHAR(255)" }] });
    });
  });

  describe("preprocessTransactionBeginParams", () => {
    it("should resolve isolation_level/level -> isolationLevel", () => {
      expect(preprocessTransactionBeginParams({ isolation_level: "READ COMMITTED" })).toMatchObject({ isolationLevel: "READ COMMITTED" });
      expect(preprocessTransactionBeginParams({ level: "READ COMMITTED" })).toMatchObject({ isolationLevel: "READ COMMITTED" });
    });
  });

  describe("preprocessTransactionExecuteParams", () => {
    it("should resolve isolation_level -> isolationLevel", () => {
      expect(preprocessTransactionExecuteParams({ isolation_level: "R" })).toMatchObject({ isolationLevel: "R" });
    });
    it("should resolve queries/sqls/query/sql -> statements", () => {
      expect(preprocessTransactionExecuteParams({ queries: ["s1"] })).toMatchObject({ statements: ["s1"] });
      expect(preprocessTransactionExecuteParams({ sqls: ["s1"] })).toMatchObject({ statements: ["s1"] });
      expect(preprocessTransactionExecuteParams({ query: "s1" })).toMatchObject({ statements: ["s1"] });
      expect(preprocessTransactionExecuteParams({ sql: "s1" })).toMatchObject({ statements: ["s1"] });
    });
    it("should extract sql from object statements array", () => {
      expect(preprocessTransactionExecuteParams({ sql: [{ sql: "s1" }, { query: "s2" }] })).toMatchObject({ statements: ["s1", "s2"] });
    });
  });

  describe("preprocessJsonColumnParams", () => {
    it("should resolve where aliases", () => {
      expect(preprocessJsonColumnParams({ filter: "id=1" })).toMatchObject({ where: "id=1" });
      expect(preprocessJsonColumnParams({ condition: "id=1" })).toMatchObject({ where: "id=1" });
      expect(preprocessJsonColumnParams({ query: "id=1" })).toMatchObject({ where: "id=1" });
      expect(preprocessJsonColumnParams({ sql: "id=1" })).toMatchObject({ where: "id=1" });
    });
    it("should build where from idColumn and rowId", () => {
      expect(preprocessJsonColumnParams({ idColumn: "id", rowId: 1 })).toMatchObject({ where: "`id` = 1" });
      expect(preprocessJsonColumnParams({ idColumn: "id", rowId: "abc" })).toMatchObject({ where: "`id` = 'abc'" });
    });
    it("should resolve table, column, path aliases", () => {
      expect(preprocessJsonColumnParams({ tableName: "t", col: "c", json_path: "p", searchString: "s" })).toMatchObject({ table: "t", column: "c", path: "p", searchValue: "s" });
      expect(preprocessJsonColumnParams({ name: "t", columnName: "c", jsonPath: "p" })).toMatchObject({ table: "t", column: "c", path: "p" });
      expect(preprocessJsonColumnParams({ tbl: "t", valueColumn: "c" })).toMatchObject({ table: "t", column: "c" });
      expect(preprocessJsonColumnParams({ table_name: "t", fieldName: "c" })).toMatchObject({ table: "t", column: "c" });
      expect(preprocessJsonColumnParams({ c: "c" })).toMatchObject({ column: "c" });
    });
  });

  describe("preprocessQueryOnlyParams", () => {
    it("should resolve sql -> query", () => {
      expect(preprocessQueryOnlyParams({ sql: "s" })).toMatchObject({ query: "s" });
    });
  });

  describe("preprocessAdminTableParams", () => {
    it("should map table, tableName, name to tables array", () => {
      expect(preprocessAdminTableParams({ table: "t1" })).toMatchObject({ tables: ["t1"] });
      expect(preprocessAdminTableParams({ table: ["t1"] })).toMatchObject({ tables: ["t1"] });
      expect(preprocessAdminTableParams({ tableName: "t1" })).toMatchObject({ tables: ["t1"] });
      expect(preprocessAdminTableParams({ tableName: ["t1"] })).toMatchObject({ tables: ["t1"] });
      expect(preprocessAdminTableParams({ name: "t1" })).toMatchObject({ tables: ["t1"] });
      expect(preprocessAdminTableParams({ name: ["t1"] })).toMatchObject({ tables: ["t1"] });
    });
    it("should preserve tables array", () => {
      expect(preprocessAdminTableParams({ tables: ["t1"] })).toMatchObject({ tables: ["t1"] });
      expect(preprocessAdminTableParams({ tables: "t1" })).toMatchObject({ tables: ["t1"] });
    });
  });

  describe("preprocessDocFilterParams", () => {
    it("should resolve filter aliases", () => {
      expect(preprocessDocFilterParams({ documentId: "1" })).toMatchObject({ filter: "1" });
      expect(preprocessDocFilterParams({ documentId: 1 })).toMatchObject({ filter: "1" });
      expect(preprocessDocFilterParams({ documentId: { a: 1 } })).toMatchObject({ filter: '{"a":1}' });
      expect(preprocessDocFilterParams({ criteria: { a: 1 } })).toMatchObject({ filter: '{"a":1}' });
      expect(preprocessDocFilterParams({ condition: { a: 1 } })).toMatchObject({ filter: '{"a":1}' });
      expect(preprocessDocFilterParams({ query: { a: 1 } })).toMatchObject({ filter: '{"a":1}' });
      expect(preprocessDocFilterParams({ sql: { a: 1 } })).toMatchObject({ filter: '{"a":1}' });
      expect(preprocessDocFilterParams({ where: { a: 1 } })).toMatchObject({ filter: '{"a":1}' });
    });
    it("should clear empty filters", () => {
      expect(preprocessDocFilterParams({ filter: {} })).toMatchObject({});
      expect(preprocessDocFilterParams({ filter: "{}" })).toMatchObject({});
      expect(preprocessDocFilterParams({ filter: "[]" })).toMatchObject({});
      expect(preprocessDocFilterParams({ filter: "" })).toMatchObject({});
    });
    it("should resolve set aliases", () => {
      expect(preprocessDocFilterParams({ patch: { a: 1 } })).toMatchObject({ set: { a: 1 } });
      expect(preprocessDocFilterParams({ update: { a: 1 } })).toMatchObject({ set: { a: 1 } });
    });
  });

  describe("preprocessEventParams", () => {
    it("should resolve eventName -> name", () => {
      expect(preprocessEventParams({ eventName: "e" })).toMatchObject({ name: "e" });
    });
  });

  describe("preprocessDocIndexParams", () => {
    it("should resolve collection and schema aliases", () => {
      expect(preprocessDocIndexParams({ table: "c", database: "d" })).toMatchObject({ collection: "c", schema: "d" });
      expect(preprocessDocIndexParams({ tableName: "c" })).toMatchObject({ collection: "c" });
    });
    it("should resolve name aliases", () => {
      expect(preprocessDocIndexParams({ indexName: "i" })).toMatchObject({ name: "i" });
      expect(preprocessDocIndexParams({ index: "i" })).toMatchObject({ name: "i" });
    });
    it("should process fields", () => {
      expect(preprocessDocIndexParams({ fields: "f" })).toMatchObject({ fields: [{ path: "f" }] });
      expect(preprocessDocIndexParams({ fields: ["f"] })).toMatchObject({ fields: [{ path: "f" }] });
      expect(preprocessDocIndexParams({ fields: [{ field: "f", type: "integer" }] })).toMatchObject({ fields: [{ path: "f", type: "INT" }] });
    });
  });

  describe("preprocessBinlogEventsParams", () => {
    it("should resolve logFile aliases", () => {
      expect(preprocessBinlogEventsParams({ file: "f" })).toMatchObject({ logFile: "f" });
      expect(preprocessBinlogEventsParams({ filename: "f" })).toMatchObject({ logFile: "f" });
      expect(preprocessBinlogEventsParams({ fileName: "f" })).toMatchObject({ logFile: "f" });
      expect(preprocessBinlogEventsParams({ binlog: "f" })).toMatchObject({ logFile: "f" });
      expect(preprocessBinlogEventsParams({ log_file: "f" })).toMatchObject({ logFile: "f" });
      expect(preprocessBinlogEventsParams({ name: "f" })).toMatchObject({ logFile: "f" });
    });
    it("should resolve position aliases", () => {
      expect(preprocessBinlogEventsParams({ pos: 1 })).toMatchObject({ position: 1 });
      expect(preprocessBinlogEventsParams({ start: 1 })).toMatchObject({ position: 1 });
    });
  });

  describe("preprocessSpatialParams", () => {
    it("should resolve spatialColumn aliases", () => {
      expect(preprocessSpatialParams({ geometryColumn: "c" })).toMatchObject({ spatialColumn: "c" });
      expect(preprocessSpatialParams({ column: "c" })).toMatchObject({ spatialColumn: "c" });
      expect(preprocessSpatialParams({ columnName: "c" })).toMatchObject({ spatialColumn: "c" });
      expect(preprocessSpatialParams({ geomColumn: "c" })).toMatchObject({ spatialColumn: "c" });
    });
    it("should resolve polygon aliases", () => {
      expect(preprocessSpatialParams({ wkt: "p" })).toMatchObject({ polygon: "p", geometry: "p" });
      expect(preprocessSpatialParams({ geometry: "p" })).toMatchObject({ polygon: "p", geometry: "p" });
      expect(preprocessSpatialParams({ value: "p" })).toMatchObject({ polygon: "p" });
      expect(preprocessSpatialParams({ point: [1, 2] })).toMatchObject({ polygon: "[1,2]" });
    });
    it("should resolve geometry1/geometry2 aliases", () => {
      expect(preprocessSpatialParams({ geomColumn1: "g1", geomColumn2: "g2" })).toMatchObject({ geometry1: "g1", geometry2: "g2" });
    });
  });

  describe("preprocessStatsParams", () => {
    it("should resolve column aliases", () => {
      expect(preprocessStatsParams({ columnName: "c" })).toMatchObject({ column: "c" });
      expect(preprocessStatsParams({ col: "c" })).toMatchObject({ column: "c" });
      expect(preprocessStatsParams({ fieldName: "c" })).toMatchObject({ column: "c" });
    });
    it("should resolve timeColumn aliases", () => {
      expect(preprocessStatsParams({ time: "t" })).toMatchObject({ timeColumn: "t" });
      expect(preprocessStatsParams({ dateColumn: "t" })).toMatchObject({ timeColumn: "t" });
      expect(preprocessStatsParams({ timestamp: "t" })).toMatchObject({ timeColumn: "t" });
    });
    it("should resolve valueColumn aliases", () => {
      expect(preprocessStatsParams({ val: "v" })).toMatchObject({ valueColumn: "v" });
      expect(preprocessStatsParams({ value: "v" })).toMatchObject({ valueColumn: "v" });
      expect(preprocessStatsParams({ valColumn: "v" })).toMatchObject({ valueColumn: "v" });
    });
    it("should resolve xColumn/yColumn aliases", () => {
      expect(preprocessStatsParams({ columnX: "x" })).toMatchObject({ xColumn: "x" });
      expect(preprocessStatsParams({ colX: "x" })).toMatchObject({ xColumn: "x" });
      expect(preprocessStatsParams({ x: "x" })).toMatchObject({ xColumn: "x" });
      expect(preprocessStatsParams({ columnY: "y" })).toMatchObject({ yColumn: "y" });
      expect(preprocessStatsParams({ colY: "y" })).toMatchObject({ yColumn: "y" });
      expect(preprocessStatsParams({ y: "y" })).toMatchObject({ yColumn: "y" });
    });
  });
});
