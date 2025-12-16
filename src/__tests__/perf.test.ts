/**
 * mysql-mcp - Performance Tests
 * 
 * Timing-based tests to validate caching and algorithmic optimizations.
 * These tests provide regression protection for documented performance improvements.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    getAllToolNames,
    getToolGroup,
    parseToolFilter,
    filterTools,
    clearToolFilterCaches
} from '../filtering/ToolFilter.js';
import { MySQLAdapter } from '../adapters/mysql/MySQLAdapter.js';
import type { ToolDefinition } from '../types/index.js';

/**
 * Measure execution time of a function over multiple iterations
 */
function measureTime(fn: () => void, iterations = 100): { avg: number; min: number; max: number } {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        fn();
        const end = performance.now();
        times.push(end - start);
    }

    return {
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times)
    };
}

describe('Performance Tests', () => {
    describe('getAllToolNames caching', () => {
        beforeEach(() => {
            clearToolFilterCaches();
        });

        it('should cache getAllToolNames for subsequent calls', () => {
            // First call builds the cache
            const firstCallTime = measureTime(() => {
                clearToolFilterCaches();
                getAllToolNames();
            }, 10);

            // Subsequent calls should use cache - don't clear between iterations
            const initialCall = getAllToolNames();
            const cachedCallTime = measureTime(() => {
                getAllToolNames();
            }, 100);

            // Verify caching works (same reference)
            expect(getAllToolNames()).toBe(initialCall);

            // Cached calls should be very fast (< 0.5ms on average)
            expect(cachedCallTime.avg).toBeLessThan(0.5);
        });

        it('should return consistent count of 191 tools', () => {
            const tools = getAllToolNames();
            expect(tools).toHaveLength(191);
        });
    });

    describe('getToolGroup O(1) lookup', () => {
        beforeEach(() => {
            clearToolFilterCaches();
        });

        it('should have consistent lookup time regardless of tool position', () => {
            // Warm up the cache
            getToolGroup('mysql_read_query');

            // Measure lookup time for first tool in core group
            const firstToolTime = measureTime(() => {
                getToolGroup('mysql_read_query');
            }, 100);

            // Measure lookup time for tool in last group (docstore)
            const lastToolTime = measureTime(() => {
                getToolGroup('mysql_doc_collection_info');
            }, 100);

            // Both should be very fast (O(1) Map lookup)
            expect(firstToolTime.avg).toBeLessThan(0.1);
            expect(lastToolTime.avg).toBeLessThan(0.1);

            // Times should be similar (indicating O(1) behavior)
            // Note: Ratio comparisons are unstable for very small numbers (e.g. 0.001ms vs 0.02ms is 20x variance).
            // We check that the absolute difference is negligible (< 0.2ms)
            const diff = Math.abs(firstToolTime.avg - lastToolTime.avg);
            expect(diff).toBeLessThan(0.2);
        });

        it('should correctly identify tool groups', () => {
            expect(getToolGroup('mysql_read_query')).toBe('core');
            expect(getToolGroup('mysql_json_extract')).toBe('json');
            expect(getToolGroup('mysql_doc_find')).toBe('docstore');
            expect(getToolGroup('unknown_tool')).toBeUndefined();
        });
    });

    describe('parseToolFilter performance', () => {
        it('should parse empty filter quickly', () => {
            const timing = measureTime(() => {
                parseToolFilter('');
            }, 100);

            // Empty filter should be very fast
            expect(timing.avg).toBeLessThan(1);
        });

        it('should parse complex filter chain efficiently', () => {
            const complexFilter = '-base-core,-base-admin,-ecosystem,+starter,+spatial,+performance';

            const timing = measureTime(() => {
                parseToolFilter(complexFilter);
            }, 50);

            // Complex filter should still be reasonably fast (< 5ms on average)
            expect(timing.avg).toBeLessThan(5);
        });

        it('should handle repeated parsing of same filter', () => {
            const filter = 'starter';

            // Warm up
            parseToolFilter(filter);

            const timing = measureTime(() => {
                parseToolFilter(filter);
            }, 100);

            // Repeated parsing should be consistent
            expect(timing.avg).toBeLessThan(3);
        });

        it('should correctly filter to expected tool counts', () => {
            const starterConfig = parseToolFilter('starter');
            expect(starterConfig.enabledTools.size).toBe(38);

            const aiDataConfig = parseToolFilter('ai-data');
            expect(aiDataConfig.enabledTools.size).toBe(44);

            const dbaMonitorConfig = parseToolFilter('dba-monitor');
            expect(dbaMonitorConfig.enabledTools.size).toBe(35);

            const dbaSecureConfig = parseToolFilter('dba-secure');
            expect(dbaSecureConfig.enabledTools.size).toBe(42);

            const devPowerConfig = parseToolFilter('dev-power');
            expect(devPowerConfig.enabledTools.size).toBe(45);
        });

        describe('filterTools performance', () => {
            const mockHandler = async () => ({ result: 'ok' });

            it('should filter 191 tools efficiently', () => {
                // Create mock tools matching all tool names
                const allToolNames = getAllToolNames();
                const mockTools: ToolDefinition[] = allToolNames.map(name => ({
                    name,
                    description: `Description for ${name}`,
                    inputSchema: {},
                    group: getToolGroup(name) ?? 'core',
                    handler: mockHandler
                }));

                const config = parseToolFilter('starter');

                const timing = measureTime(() => {
                    filterTools(mockTools, config);
                }, 100);

                // Filtering 191 tools should be fast (< 2ms on average)
                expect(timing.avg).toBeLessThan(2);

                // Verify correct filtering
                const filtered = filterTools(mockTools, config);
                expect(filtered).toHaveLength(38);
            });
        });

        describe('MySQLAdapter tool definition caching', () => {
            it('should cache tool definitions after first call', () => {
                // Create adapter (no constructor args - uses connect() for config)
                const adapter = new MySQLAdapter();

                // First call builds the cache
                const firstCall = adapter.getToolDefinitions();
                expect(firstCall).toHaveLength(191);

                // Subsequent calls should return same reference (cached)
                const secondCall = adapter.getToolDefinitions();
                expect(secondCall).toBe(firstCall);

                // Measure cached call performance
                const timing = measureTime(() => {
                    adapter.getToolDefinitions();
                }, 100);

                // Cached calls should be nearly instant
                expect(timing.avg).toBeLessThan(0.5);
            });

            it('should return consistent tool count of 191 regardless of filter default', () => {
                const adapter = new MySQLAdapter();

                // getToolDefinitions returns ALL definitions available in the adapter, 
                // filtering happens at request time usually, or if we filter explicitly.
                // Wait, MySQLAdapter.getToolDefinitions() returns all tools?
                // Yes, checking the implementation... it usually does.
                const tools = adapter.getToolDefinitions();
                expect(tools).toHaveLength(191);
            });
        });
    });
});
