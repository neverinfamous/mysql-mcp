
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as child_process from 'child_process';
import { createMockMySQLAdapter, createMockRequestContext } from '../../../../../__tests__/mocks/index.js';
import {
    createShellExportTableTool,
    createShellImportTableTool,
    createShellImportJSONTool
} from '../data-transfer.js';

vi.mock('child_process', () => ({
    spawn: vi.fn()
}));

describe('Shell Data Transfer Tools', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;
    let mockSpawn: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
        mockSpawn = child_process.spawn as any;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function setupMockSpawn(stdout = '', stderr = '', exitCode = 0) {
        const mockChild = {
            stdout: {
                on: vi.fn().mockImplementation((event, cb) => {
                    if (event === 'data') cb(Buffer.from(stdout));
                })
            },
            stderr: {
                on: vi.fn().mockImplementation((event, cb) => {
                    if (event === 'data') cb(Buffer.from(stderr));
                })
            },
            stdin: {
                write: vi.fn(),
                end: vi.fn()
            },
            on: vi.fn().mockImplementation((event, cb) => {
                if (event === 'close') cb(exitCode);
            }),
            kill: vi.fn()
        };
        mockSpawn.mockReturnValue(mockChild);
        return mockChild;
    }

    describe('mysqlsh_export_table', () => {
        it('should export table with CSV format and options', async () => {
            const successJson = JSON.stringify({ success: true, result: { rows: 100 } });
            setupMockSpawn(successJson);

            const tool = createShellExportTableTool();
            const result = await tool.handler({
                schema: 'test',
                table: 'users',
                outputPath: '/tmp/dump',
                format: 'csv'
            }, mockContext) as any;

            expect(result.success).toBe(true);
            expect(result.result).toEqual({ rows: 100 });

            const jsArg = mockSpawn.mock.calls[0][1][4];
            expect(jsArg).toContain('util.exportTable("test.users"');
            expect(jsArg).toContain('fieldsTerminatedBy: ","');
            expect(jsArg).toContain('fieldsEnclosedBy: "\\""');
        });

        it('should export table with TSV format', async () => {
            setupMockSpawn(JSON.stringify({ success: true }));

            const tool = createShellExportTableTool();
            await tool.handler({
                schema: 'test',
                table: 'users',
                outputPath: '/tmp/dump.tsv',
                format: 'tsv'
            }, mockContext);

            const jsArg = mockSpawn.mock.calls[0][1][4];
            expect(jsArg).toContain('fieldsTerminatedBy: "\\t"');
        });

        it('should export table with WHERE clause and specific columns', async () => {
            setupMockSpawn(JSON.stringify({ success: true }));

            const tool = createShellExportTableTool();
            await tool.handler({
                schema: 'test',
                table: 'users',
                outputPath: '/tmp/users_filtered',
                format: 'json',
                where: 'age > 18',
                columns: ['id', 'name']
            }, mockContext);

            const jsArg = mockSpawn.mock.calls[0][1][4];
            expect(jsArg).toContain('where: "age > 18"');
            expect(jsArg).toContain('columns: ["id","name"]');
        });

        it('should escape backslashes in path', async () => {
            setupMockSpawn(JSON.stringify({ success: true }));

            const tool = createShellExportTableTool();
            await tool.handler({
                schema: 'test',
                table: 'users',
                outputPath: 'C:\\temp\\dump',
                format: 'json'
            }, mockContext);

            const jsArg = mockSpawn.mock.calls[0][1][4];
            // In JS code it should be escaped: C:\\temp\\dump
            // So we look for "C:\\temp\\dump" in the string
            expect(jsArg).toContain('C:\\\\temp\\\\dump');
        });
    });

    describe('mysqlsh_import_table', () => {
        it('should import table with options', async () => {
            const successJson = JSON.stringify({ success: true, result: { status: 'Done' } });
            setupMockSpawn(successJson);

            const tool = createShellImportTableTool();
            const result = await tool.handler({
                schema: 'test',
                table: 'users',
                inputPath: '/tmp/data.csv',
                threads: 4,
                skipRows: 1,
                fieldsTerminatedBy: ',',
                linesTerminatedBy: '\n',
                columns: ['id', 'name']
            }, mockContext) as any;

            expect(result.success).toBe(true);
            const jsArg = mockSpawn.mock.calls[0][1][4];
            expect(jsArg).toContain('util.importTable("/tmp/data.csv"');
            expect(jsArg).toContain('threads: 4');
            expect(jsArg).toContain('skipRows: 1');
            expect(jsArg).toContain('fieldsTerminatedBy: ","');
            expect(jsArg).toContain('linesTerminatedBy: "\\n"');
            expect(jsArg).toContain('columns: ["id","name"]');
        });
    });

    describe('mysqlsh_import_json', () => {
        it('should import JSON to collection', async () => {
            const successJson = JSON.stringify({ success: true, result: { imported: 50 } });
            setupMockSpawn(successJson);

            const tool = createShellImportJSONTool();
            const result = await tool.handler({
                inputPath: '/tmp/docs.json',
                schema: 'test',
                collection: 'docs'
            }, mockContext) as any;

            expect(result.success).toBe(true);
            expect(result.protocol).toBe('X Protocol');

            const jsArg = mockSpawn.mock.calls[0][1][4];
            expect(jsArg).toContain('collection: "docs"');
        });

        it('should import JSON to table column with BSON types conversion', async () => {
            const successJson = JSON.stringify({ success: true, result: { imported: 50 } });
            setupMockSpawn(successJson);

            const tool = createShellImportJSONTool();
            await tool.handler({
                inputPath: '/tmp/data.json',
                schema: 'test',
                collection: 'my_table', // 'collection' param is used as table name when tableColumn is present logic-wise?
                // Wait, let's check source code logic. 
                // if (tableColumn) { options.push(`table: "${collection}"`); options.push(`tableColumn: "${tableColumn}"`); }
                // So yes, schema.collection maps to inputSchema 'collection' field which seems to be used as table name here.
                tableColumn: 'data_col',
                convertBsonTypes: true
            }, mockContext);

            const jsArg = mockSpawn.mock.calls[0][1][4];
            expect(jsArg).toContain('table: "my_table"');
            expect(jsArg).toContain('tableColumn: "data_col"');
            expect(jsArg).toContain('convertBsonTypes: true');
        });

        it('should return raw output when no JSON found but exit code 0', async () => {
            setupMockSpawn('Some non-JSON success output', '', 0);

            const tool = createShellImportJSONTool();
            const result = await tool.handler({
                inputPath: '/tmp/docs.json',
                schema: 'test',
                collection: 'docs'
            }, mockContext) as any;

            expect(result.success).toBe(true);
            expect(result.result.raw).toBe('Some non-JSON success output');
        });

        it('should handle import failure', async () => {
            setupMockSpawn('Import failed', '', 1);

            const tool = createShellImportJSONTool();
            await expect(tool.handler({
                inputPath: '/tmp/bad.json',
                schema: 'test',
                collection: 'docs'
            }, mockContext)).rejects.toThrow('Import failed');
        });
    });
});
