/**
 * mysql-mcp - OAuth Error Classes Unit Tests
 * 
 * Tests for all custom OAuth error classes.
 */

import { describe, it, expect } from 'vitest';
import {
    OAuthError,
    TokenMissingError,
    InvalidTokenError,
    TokenExpiredError,
    InvalidSignatureError,
    InsufficientScopeError,
    AuthServerDiscoveryError,
    JwksFetchError,
    ClientRegistrationError
} from '../errors.js';

describe('OAuth Error Classes', () => {
    describe('OAuthError', () => {
        it('should create error with correct properties', () => {
            const error = new OAuthError('Test error', 'TEST_CODE', 400);

            expect(error.message).toBe('Test error');
            expect(error.code).toBe('TEST_CODE');
            expect(error.httpStatus).toBe(400);
            expect(error.name).toBe('OAuthError');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(OAuthError);
        });
    });

    describe('TokenMissingError', () => {
        it('should create error with default message', () => {
            const error = new TokenMissingError();

            expect(error.message).toBe('No bearer token provided');
            expect(error.code).toBe('TOKEN_MISSING');
            expect(error.httpStatus).toBe(401);
            expect(error.name).toBe('TokenMissingError');
        });

        it('should be instanceof OAuthError', () => {
            const error = new TokenMissingError();
            expect(error).toBeInstanceOf(OAuthError);
        });
    });

    describe('InvalidTokenError', () => {
        it('should create error with default message', () => {
            const error = new InvalidTokenError();

            expect(error.message).toBe('Invalid access token');
            expect(error.code).toBe('INVALID_TOKEN');
            expect(error.httpStatus).toBe(401);
            expect(error.name).toBe('InvalidTokenError');
        });

        it('should accept custom message', () => {
            const error = new InvalidTokenError('Token format invalid');
            expect(error.message).toBe('Token format invalid');
        });
    });

    describe('TokenExpiredError', () => {
        it('should create error with default message', () => {
            const error = new TokenExpiredError();

            expect(error.message).toBe('Access token has expired');
            expect(error.code).toBe('TOKEN_EXPIRED');
            expect(error.httpStatus).toBe(401);
            expect(error.name).toBe('TokenExpiredError');
        });

        it('should accept custom message', () => {
            const error = new TokenExpiredError('Token expired 5 minutes ago');
            expect(error.message).toBe('Token expired 5 minutes ago');
        });

        it('should be instanceof OAuthError', () => {
            const error = new TokenExpiredError();
            expect(error).toBeInstanceOf(OAuthError);
        });
    });

    describe('InvalidSignatureError', () => {
        it('should create error with default message', () => {
            const error = new InvalidSignatureError();

            expect(error.message).toBe('Invalid token signature');
            expect(error.code).toBe('INVALID_SIGNATURE');
            expect(error.httpStatus).toBe(401);
            expect(error.name).toBe('InvalidSignatureError');
        });

        it('should accept custom message', () => {
            const error = new InvalidSignatureError('Signature verification failed');
            expect(error.message).toBe('Signature verification failed');
        });

        it('should be instanceof OAuthError', () => {
            const error = new InvalidSignatureError();
            expect(error).toBeInstanceOf(OAuthError);
        });
    });

    describe('InsufficientScopeError', () => {
        it('should create error with required scopes', () => {
            const error = new InsufficientScopeError(['read', 'write']);

            expect(error.message).toBe('Insufficient scope. Required: read, write');
            expect(error.code).toBe('INSUFFICIENT_SCOPE');
            expect(error.httpStatus).toBe(403);
            expect(error.name).toBe('InsufficientScopeError');
            expect(error.requiredScopes).toEqual(['read', 'write']);
        });

        it('should accept custom message', () => {
            const error = new InsufficientScopeError(['admin'], 'Admin access required');
            expect(error.message).toBe('Admin access required');
            expect(error.requiredScopes).toEqual(['admin']);
        });
    });

    describe('AuthServerDiscoveryError', () => {
        it('should create error with default message', () => {
            const error = new AuthServerDiscoveryError();

            expect(error.message).toBe('Failed to discover authorization server metadata');
            expect(error.code).toBe('DISCOVERY_FAILED');
            expect(error.httpStatus).toBe(500);
            expect(error.name).toBe('AuthServerDiscoveryError');
        });

        it('should accept custom message', () => {
            const error = new AuthServerDiscoveryError('Server unreachable');
            expect(error.message).toBe('Server unreachable');
        });
    });

    describe('JwksFetchError', () => {
        it('should create error with default message', () => {
            const error = new JwksFetchError();

            expect(error.message).toBe('Failed to fetch JWKS');
            expect(error.code).toBe('JWKS_FETCH_FAILED');
            expect(error.httpStatus).toBe(500);
            expect(error.name).toBe('JwksFetchError');
        });

        it('should accept custom message', () => {
            const error = new JwksFetchError('JWKS endpoint returned 404');
            expect(error.message).toBe('JWKS endpoint returned 404');
        });

        it('should be instanceof OAuthError', () => {
            const error = new JwksFetchError();
            expect(error).toBeInstanceOf(OAuthError);
        });
    });

    describe('ClientRegistrationError', () => {
        it('should create error with default message', () => {
            const error = new ClientRegistrationError();

            expect(error.message).toBe('Client registration failed');
            expect(error.code).toBe('REGISTRATION_FAILED');
            expect(error.httpStatus).toBe(400);
            expect(error.name).toBe('ClientRegistrationError');
        });

        it('should accept custom message', () => {
            const error = new ClientRegistrationError('Invalid redirect URI');
            expect(error.message).toBe('Invalid redirect URI');
        });

        it('should be instanceof OAuthError', () => {
            const error = new ClientRegistrationError();
            expect(error).toBeInstanceOf(OAuthError);
        });
    });
});
