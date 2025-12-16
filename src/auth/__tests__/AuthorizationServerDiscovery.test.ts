/**
 * mysql-mcp - AuthorizationServerDiscovery Unit Tests
 * 
 * Tests for RFC 8414 authorization server metadata discovery
 * including caching behavior, error handling, and helper methods.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthorizationServerDiscovery, createAuthServerDiscovery } from '../AuthorizationServerDiscovery.js';
import { AuthServerDiscoveryError } from '../errors.js';
import type { AuthorizationServerMetadata } from '../types.js';

// Mock logger to avoid console output
vi.mock('../../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('AuthorizationServerDiscovery', () => {
    const mockMetadata: AuthorizationServerMetadata = {
        issuer: 'https://auth.example.com',
        token_endpoint: 'https://auth.example.com/token',
        authorization_endpoint: 'https://auth.example.com/authorize',
        jwks_uri: 'https://auth.example.com/.well-known/jwks.json',
        registration_endpoint: 'https://auth.example.com/register',
        grant_types_supported: ['authorization_code', 'client_credentials', 'refresh_token'],
        scopes_supported: ['read', 'write', 'admin']
    };

    let discovery: AuthorizationServerDiscovery;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        discovery = new AuthorizationServerDiscovery({
            authServerUrl: 'https://auth.example.com'
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('constructor', () => {
        it('should create instance with config', () => {
            expect(discovery).toBeInstanceOf(AuthorizationServerDiscovery);
        });

        it('should use default cacheTtl when not provided', () => {
            const disc = new AuthorizationServerDiscovery({
                authServerUrl: 'https://auth.example.com'
            });
            expect(disc).toBeDefined();
        });

        it('should use custom cacheTtl when provided', () => {
            const disc = new AuthorizationServerDiscovery({
                authServerUrl: 'https://auth.example.com',
                cacheTtl: 1800
            });
            expect(disc).toBeDefined();
        });

        it('should use custom timeout when provided', () => {
            const disc = new AuthorizationServerDiscovery({
                authServerUrl: 'https://auth.example.com',
                timeout: 10000
            });
            expect(disc).toBeDefined();
        });
    });

    describe('discover()', () => {
        it('should fetch metadata from well-known endpoint', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockMetadata
            });

            const result = await discovery.discover();

            expect(mockFetch).toHaveBeenCalledWith(
                'https://auth.example.com/.well-known/oauth-authorization-server',
                expect.objectContaining({
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                })
            );
            expect(result).toEqual(mockMetadata);
        });

        it('should cache metadata within TTL', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockMetadata
            });

            // First call - fetches from network
            const result1 = await discovery.discover();
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Advance time by 30 minutes (within default 1 hour TTL)
            vi.advanceTimersByTime(30 * 60 * 1000);

            // Second call - should use cache
            const result2 = await discovery.discover();
            expect(mockFetch).toHaveBeenCalledTimes(1); // No additional fetch
            expect(result2).toEqual(result1);
        });

        it('should refresh cache after TTL expires', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => mockMetadata
            });

            // First call
            await discovery.discover();
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Advance time past TTL (default 3600 seconds)
            vi.advanceTimersByTime(3601 * 1000);

            // Second call - should refetch
            await discovery.discover();
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should throw AuthServerDiscoveryError on HTTP error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found'
            });

            await expect(discovery.discover()).rejects.toThrow(AuthServerDiscoveryError);
        });

        it('should throw AuthServerDiscoveryError on network error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(discovery.discover()).rejects.toThrow(AuthServerDiscoveryError);
        });

        it('should throw AuthServerDiscoveryError when metadata missing required fields', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ issuer: 'https://auth.example.com' }) // Missing token_endpoint
            });

            await expect(discovery.discover()).rejects.toThrow(AuthServerDiscoveryError);
        });

        it('should throw AuthServerDiscoveryError when issuer is missing', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ token_endpoint: 'https://auth.example.com/token' }) // Missing issuer
            });

            await expect(discovery.discover()).rejects.toThrow(AuthServerDiscoveryError);
        });
    });

    describe('getJwksUri()', () => {
        it('should return JWKS URI from metadata', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockMetadata
            });

            const jwksUri = await discovery.getJwksUri();
            expect(jwksUri).toBe('https://auth.example.com/.well-known/jwks.json');
        });

        it('should throw when JWKS URI not in metadata', async () => {
            const metadataWithoutJwks = {
                issuer: 'https://auth.example.com',
                token_endpoint: 'https://auth.example.com/token'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => metadataWithoutJwks
            });

            await expect(discovery.getJwksUri()).rejects.toThrow(AuthServerDiscoveryError);
            await expect(discovery.getJwksUri()).rejects.toThrow('does not include jwks_uri');
        });
    });

    describe('getTokenEndpoint()', () => {
        it('should return token endpoint from metadata', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockMetadata
            });

            const tokenEndpoint = await discovery.getTokenEndpoint();
            expect(tokenEndpoint).toBe('https://auth.example.com/token');
        });
    });

    describe('getRegistrationEndpoint()', () => {
        it('should return registration endpoint when available', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockMetadata
            });

            const registrationEndpoint = await discovery.getRegistrationEndpoint();
            expect(registrationEndpoint).toBe('https://auth.example.com/register');
        });

        it('should return undefined when registration endpoint not available', async () => {
            const metadataWithoutRegistration = {
                issuer: 'https://auth.example.com',
                token_endpoint: 'https://auth.example.com/token'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => metadataWithoutRegistration
            });

            const registrationEndpoint = await discovery.getRegistrationEndpoint();
            expect(registrationEndpoint).toBeUndefined();
        });
    });

    describe('supportsGrantType()', () => {
        it('should return true for supported grant type', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockMetadata
            });

            const supports = await discovery.supportsGrantType('client_credentials');
            expect(supports).toBe(true);
        });

        it('should return false for unsupported grant type', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockMetadata
            });

            const supports = await discovery.supportsGrantType('implicit');
            expect(supports).toBe(false);
        });

        it('should return false when grant_types_supported not in metadata', async () => {
            const metadataWithoutGrants = {
                issuer: 'https://auth.example.com',
                token_endpoint: 'https://auth.example.com/token'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => metadataWithoutGrants
            });

            const supports = await discovery.supportsGrantType('authorization_code');
            expect(supports).toBe(false);
        });
    });

    describe('invalidateCache()', () => {
        it('should clear cached metadata', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => mockMetadata
            });

            // First call populates cache
            await discovery.discover();
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Invalidate cache
            discovery.invalidateCache();

            // Next call should refetch
            await discovery.discover();
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });
});

describe('createAuthServerDiscovery()', () => {
    it('should create AuthorizationServerDiscovery instance', () => {
        const discovery = createAuthServerDiscovery({
            authServerUrl: 'https://auth.example.com'
        });
        expect(discovery).toBeInstanceOf(AuthorizationServerDiscovery);
    });

    it('should pass all config options', () => {
        const discovery = createAuthServerDiscovery({
            authServerUrl: 'https://auth.example.com',
            cacheTtl: 1800,
            timeout: 10000
        });
        expect(discovery).toBeInstanceOf(AuthorizationServerDiscovery);
    });
});
