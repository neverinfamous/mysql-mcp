/**
 * mysql-mcp - Logger Unit Tests
 * 
 * Tests for the centralized logger module including
 * sensitive data redaction, log level control, and message formatting.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { logger } from '../logger.js';

describe('Logger', () => {
    let originalConsoleError: typeof console.error;
    let consoleErrorSpy: Mock;

    beforeEach(() => {
        originalConsoleError = console.error;
        consoleErrorSpy = vi.fn();
        console.error = consoleErrorSpy as unknown as typeof console.error;
        // Reset to default level
        logger.setLevel('info');
    });

    afterEach(() => {
        console.error = originalConsoleError;
    });

    describe('log level control', () => {
        it('should get current log level', () => {
            expect(logger.getLevel()).toBe('info');
        });

        it('should set log level to debug', () => {
            logger.setLevel('debug');
            expect(logger.getLevel()).toBe('debug');
        });

        it('should set log level to warn', () => {
            logger.setLevel('warn');
            expect(logger.getLevel()).toBe('warn');
        });

        it('should set log level to error', () => {
            logger.setLevel('error');
            expect(logger.getLevel()).toBe('error');
        });

        it('should filter debug messages when level is info', () => {
            logger.setLevel('info');
            logger.debug('Debug message');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('should allow debug messages when level is debug', () => {
            logger.setLevel('debug');
            logger.debug('Debug message');
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should filter info messages when level is warn', () => {
            logger.setLevel('warn');
            logger.info('Info message');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('should filter warn messages when level is error', () => {
            logger.setLevel('error');
            logger.warn('Warning message');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('should always allow error messages', () => {
            logger.setLevel('error');
            logger.error('Error message');
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('basic logging', () => {
        it('should log info messages', () => {
            logger.info('Test info message');
            expect(consoleErrorSpy).toHaveBeenCalled();
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).toContain('[mysql-mcp]');
            expect(output).toContain('INFO');
            expect(output).toContain('Test info message');
        });

        it('should log warn messages', () => {
            logger.warn('Test warning');
            expect(consoleErrorSpy).toHaveBeenCalled();
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).toContain('WARN');
        });

        it('should log error messages', () => {
            logger.error('Test error');
            expect(consoleErrorSpy).toHaveBeenCalled();
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).toContain('ERROR');
        });

        it('should log debug messages when level is debug', () => {
            logger.setLevel('debug');
            logger.debug('Test debug');
            expect(consoleErrorSpy).toHaveBeenCalled();
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).toContain('DEBUG');
        });
    });

    describe('context logging', () => {
        it('should include context in log output', () => {
            logger.info('Message with context', { key: 'value' });
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).toContain('"key":"value"');
        });

        it('should handle empty context', () => {
            logger.info('Message', {});
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).not.toContain('{}');
        });
    });

    describe('sensitive data redaction', () => {
        it('should redact password in context', () => {
            logger.info('Login attempt', { password: 'secret123' });
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).toContain('[REDACTED]');
            expect(output).not.toContain('secret123');
        });

        it('should redact token in context', () => {
            logger.info('Auth check', { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' });
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
        });

        it('should redact secret in context', () => {
            logger.info('Config', { secret: 'mysecretvalue' });
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).not.toContain('mysecretvalue');
        });

        it('should redact apiKey in context', () => {
            logger.info('API call', { apiKey: 'sk_test_12345' });
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).not.toContain('sk_test_12345');
        });

        it('should redact authorization in context', () => {
            logger.info('Request', { authorization: 'Bearer token123' });
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).not.toContain('token123');
        });

        it('should redact nested sensitive values', () => {
            logger.info('Config', {
                database: {
                    password: 'dbpass123'
                }
            });
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).not.toContain('dbpass123');
        });

        it('should redact password= pattern in message', () => {
            logger.info('Connection: password=secretpass');
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).toContain('[REDACTED]');
            expect(output).not.toContain('secretpass');
        });

        it('should redact password: pattern in message', () => {
            logger.info('Config password: mysecret123');
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).not.toContain('mysecret123');
        });

        it('should redact authorization bearer header in message', () => {
            logger.info('Header: authorization: bearer mytoken123');
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).not.toContain('mytoken123');
        });

        it('should redact MySQL connection string in message', () => {
            logger.info('Connecting to mysql://root:password123@localhost/db');
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).not.toContain('password123');
        });

        it('should handle very long strings by truncating', () => {
            const longString = 'a'.repeat(15000);
            logger.info(longString);
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).toContain('[TRUNCATED]');
        });

        it('should preserve safe values in context', () => {
            logger.info('Stats', { host: 'localhost', port: 3306 });
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).toContain('"host":"localhost"');
            expect(output).toContain('"port":3306');
        });
    });

    describe('control character sanitization', () => {
        it('should remove null characters from message', () => {
            logger.info('Message with\x00null');
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).toContain('Message withnull');
            expect(output).not.toContain('\x00');
        });

        it('should remove control characters from message', () => {
            logger.info('Message\x01\x02\x03test');
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).toContain('Messagetest');
        });

        it('should preserve tabs, newlines, and carriage returns', () => {
            logger.info('Line1\nLine2\tTabbed\rReturn');
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).toContain('Line1\nLine2\tTabbed\rReturn');
        });

        it('should remove DEL character (127)', () => {
            logger.info('Delete\x7Fme');
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).toContain('Deleteme');
            expect(output).not.toContain('\x7F');
        });

        it('should handle empty strings', () => {
            logger.info('');
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).toContain('INFO');
        });
    });

    describe('string redaction in context values', () => {
        it('should redact sensitive patterns in string context values', () => {
            logger.info('Request', {
                headers: 'authorization: bearer secret_token_value'
            });
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).not.toContain('secret_token_value');
        });

        it('should handle non-string context values', () => {
            logger.info('Numbers', { count: 42, enabled: true, data: null });
            const output = consoleErrorSpy.mock.calls[0][0];
            expect(output).toContain('"count":42');
            expect(output).toContain('"enabled":true');
        });
    });
});
