/**
 * mysql-mcp - Progress Reporter Unit Tests
 * 
 * Tests for ProgressReporter and ProgressReporterFactory functionality
 * including progress notifications, completion states, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProgressReporter, progressFactory } from '../ProgressReporter.js';

describe('ProgressReporter', () => {
    let mockServer: {
        server: {
            notification: ReturnType<typeof vi.fn>;
        };
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockServer = {
            server: {
                notification: vi.fn()
            }
        };
    });

    describe('Construction', () => {
        it('should create reporter with token', () => {
            const reporter = new ProgressReporter(mockServer as never, 'token-123');
            expect(reporter.getToken()).toBe('token-123');
        });

        it('should accept numeric token', () => {
            const reporter = new ProgressReporter(mockServer as never, 42);
            expect(reporter.getToken()).toBe(42);
        });

        it('should start in active state', () => {
            const reporter = new ProgressReporter(mockServer as never, 'token');
            expect(reporter.isActive()).toBe(true);
        });
    });

    describe('report()', () => {
        it('should send progress notification', () => {
            const reporter = new ProgressReporter(mockServer as never, 'token-123');
            reporter.report(50, 100, 'Processing...');

            expect(mockServer.server.notification).toHaveBeenCalledWith({
                method: 'notifications/progress',
                params: {
                    progressToken: 'token-123',
                    progress: 50,
                    total: 100,
                    message: 'Processing...'
                }
            });
        });

        it('should work without total', () => {
            const reporter = new ProgressReporter(mockServer as never, 'token');
            reporter.report(25);

            expect(mockServer.server.notification).toHaveBeenCalledWith({
                method: 'notifications/progress',
                params: expect.objectContaining({
                    progress: 25,
                    total: undefined
                })
            });
        });

        it('should work without message', () => {
            const reporter = new ProgressReporter(mockServer as never, 'token');
            reporter.report(75, 100);

            expect(mockServer.server.notification).toHaveBeenCalledWith({
                method: 'notifications/progress',
                params: expect.objectContaining({
                    progress: 75,
                    total: 100,
                    message: undefined
                })
            });
        });

        it('should not report after completion', () => {
            const reporter = new ProgressReporter(mockServer as never, 'token');
            reporter.complete();
            mockServer.server.notification.mockClear();

            reporter.report(50);

            expect(mockServer.server.notification).not.toHaveBeenCalled();
        });
    });

    describe('complete()', () => {
        it('should send completion notification with default message', () => {
            const reporter = new ProgressReporter(mockServer as never, 'token');
            reporter.complete();

            expect(mockServer.server.notification).toHaveBeenCalledWith({
                method: 'notifications/progress',
                params: {
                    progressToken: 'token',
                    progress: 1,
                    total: 1,
                    message: 'Complete'
                }
            });
        });

        it('should send completion notification with custom message', () => {
            const reporter = new ProgressReporter(mockServer as never, 'token');
            reporter.complete('All done!');

            expect(mockServer.server.notification).toHaveBeenCalledWith({
                method: 'notifications/progress',
                params: expect.objectContaining({
                    message: 'All done!'
                })
            });
        });

        it('should set reporter to inactive', () => {
            const reporter = new ProgressReporter(mockServer as never, 'token');
            expect(reporter.isActive()).toBe(true);

            reporter.complete();

            expect(reporter.isActive()).toBe(false);
        });

        it('should only complete once', () => {
            const reporter = new ProgressReporter(mockServer as never, 'token');
            reporter.complete('First');
            reporter.complete('Second');

            expect(mockServer.server.notification).toHaveBeenCalledTimes(1);
        });
    });

    describe('error()', () => {
        it('should send error notification', () => {
            const reporter = new ProgressReporter(mockServer as never, 'token');
            reporter.error('Something went wrong');

            expect(mockServer.server.notification).toHaveBeenCalledWith({
                method: 'notifications/progress',
                params: {
                    progressToken: 'token',
                    progress: 0,
                    message: 'Error: Something went wrong'
                }
            });
        });

        it('should set reporter to inactive', () => {
            const reporter = new ProgressReporter(mockServer as never, 'token');
            reporter.error('Failed');

            expect(reporter.isActive()).toBe(false);
        });

        it('should not error after completion', () => {
            const reporter = new ProgressReporter(mockServer as never, 'token');
            reporter.complete();
            mockServer.server.notification.mockClear();

            reporter.error('Should not send');

            expect(mockServer.server.notification).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle notification errors gracefully', () => {
            mockServer.server.notification.mockImplementation(() => {
                throw new Error('Transport error');
            });

            const reporter = new ProgressReporter(mockServer as never, 'token');

            // Should not throw
            expect(() => reporter.report(50)).not.toThrow();
            expect(() => reporter.complete()).not.toThrow();
        });
    });
});

describe('ProgressReporterFactory', () => {
    let mockServer: {
        server: {
            notification: ReturnType<typeof vi.fn>;
        };
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        mockServer = {
            server: {
                notification: vi.fn()
            }
        };
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe('Availability', () => {
        it('should report unavailable before server set', async () => {
            const { progressFactory: factory } = await import('../ProgressReporter.js');
            expect(factory.isAvailable()).toBe(false);
        });

        it('should report available after server set', async () => {
            const { progressFactory: factory } = await import('../ProgressReporter.js');
            factory.setServer(mockServer as never);
            expect(factory.isAvailable()).toBe(true);
        });
    });

    describe('create()', () => {
        it('should return null when no server set', async () => {
            const { progressFactory: factory } = await import('../ProgressReporter.js');
            const reporter = factory.create('token');
            expect(reporter).toBeNull();
        });

        it('should return null when no token provided', async () => {
            const { progressFactory: factory } = await import('../ProgressReporter.js');
            factory.setServer(mockServer as never);
            const reporter = factory.create(undefined);
            expect(reporter).toBeNull();
        });

        it('should create reporter when server and token available', async () => {
            const { progressFactory: factory } = await import('../ProgressReporter.js');
            factory.setServer(mockServer as never);
            const reporter = factory.create('my-token');

            expect(reporter).not.toBeNull();
            expect(reporter?.getToken()).toBe('my-token');
        });

        it('should create functional reporter', async () => {
            const { progressFactory: factory } = await import('../ProgressReporter.js');
            factory.setServer(mockServer as never);
            const reporter = factory.create('test-token');

            reporter?.report(10, 100, 'Testing');

            expect(mockServer.server.notification).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'notifications/progress'
                })
            );
        });
    });
});
