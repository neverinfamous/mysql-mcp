const fs = require('fs');
let code = fs.readFileSync('C:/Users/chris/Desktop/mysql-mcp/src/adapters/mysql/tools/admin/__tests__/backup.test.ts', 'utf8');

// Replace mockAdapter as unknown as MySQLAdapter
code = code.replace(/mockAdapter as unknown as MySQLAdapter/g, 'mockAdapterObj');

// Add assertAdapter, assertContext to top of describe
const topRegex = /describe\("Admin Backup Tools", \(\) => \{\n/;
code = code.replace(topRegex, 'describe("Admin Backup Tools", () => {\n  function assertAdapter(obj: unknown): asserts obj is MySQLAdapter { if (!obj) throw new Error("Not an adapter"); }\n  function assertContext(obj: unknown): asserts obj is import("../../../../../types/index.js").RequestContext { if (!obj) throw new Error("Not a context"); }\n  const getCtx = (c: unknown) => { assertContext(c); return c; };\n  let mockAdapterObj: MySQLAdapter;\n');

// Update beforeEach to assign mockAdapterObj
const beforeEachRegex = /mockAdapter = createMockMySQLAdapter\(\);\n    mockContext = createMockRequestContext\(\);\n  \}\);/g;
code = code.replace(beforeEachRegex, 'mockAdapter = createMockMySQLAdapter();\n    assertAdapter(mockAdapter);\n    mockAdapterObj = mockAdapter;\n    mockContext = createMockRequestContext();\n  });');

// Replace mockContext with getCtx(mockContext)
code = code.replace(/mockContext,/g, 'getCtx(mockContext),');

// Fix cast: )) as { data: { ... } };
code = code.replace(/\)\) as \{ data: \{ [^\}]+\} \};/g, '));');
code = code.replace(/\)\) as \{ success: boolean; data: \{ [^\}]+\} \};/g, '));');
code = code.replace(/\)\) as \{ success: boolean; error: string \};/g, '));');
code = code.replace(/\)\) as \{ success: boolean; error: string; details: \{ [^\}]+\} \};/g, '));');
code = code.replace(/\)\) as \{\s+success: boolean;\s+error: string;\s+details: \{ rowsInserted: number \};\s+\};/g, '));');
code = code.replace(/\)\) as \{ success: boolean; details: \{ exists: boolean \}; error\?: string \};/g, '));');
code = code.replace(/\)\) as \{\s*success: boolean;\s*error: string;\s*\};/g, '));');

// Now add data extraction using Object.assign
code = code.replace(/const result = \(await tool\.handler\(([\s\S]*?)\)\);/g, 'const result = await tool.handler($1);\n      const data = Object.assign({ sql: "", rowCount: 0, csv: "", command: "", rowsInserted: 0 }, "data" in result && result.data ? result.data : {});\n      const details = Object.assign({ exists: true, rowsInserted: 0 }, "details" in result && result.details ? result.details : {});');

// Replace result.data. with data.
code = code.replace(/result\.data\./g, 'data.');
// Replace result.details. with details.
code = code.replace(/result\.details\./g, 'details.');
// Replace result.details?. with details.
code = code.replace(/result\.details\?\./g, 'details.');

// Replace call cast
code = code.replace(/const call = mockAdapter\.executeReadQuery\.mock\.calls\[1\]\[0\] as string;/g, 'const call = String(mockAdapter.executeReadQuery.mock.calls[1][0] ?? "");');
code = code.replace(/const call = mockAdapter\.executeWriteQuery\.mock\.calls\[0\]\[0\] as string;/g, 'const call = String(mockAdapter.executeWriteQuery.mock.calls[0][0] ?? "");');

fs.writeFileSync('C:/Users/chris/Desktop/mysql-mcp/src/adapters/mysql/tools/admin/__tests__/backup.test.ts', code);
