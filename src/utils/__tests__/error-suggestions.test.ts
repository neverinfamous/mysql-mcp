import { describe, it, expect } from 'vitest';
import { findSuggestion, heuristicCategorize } from '../error-suggestions.js';
import { ErrorCategory } from '../../types/modules/error-types.js';

describe('error-suggestions', () => {
  describe('findSuggestion', () => {
    it('should find suggestion for known pattern', () => {
      const result = findSuggestion("Table 'mydb.users' doesn't exist");
      expect(result).not.toBeNull();
      expect(result?.category).toBe(ErrorCategory.RESOURCE);
      expect(result?.code).toBe('TABLE_NOT_FOUND');
    });

    it('should return null for unknown pattern', () => {
      const result = findSuggestion("Some completely unknown weird error message");
      expect(result).toBeNull();
    });
  });

  describe('heuristicCategorize', () => {
    it('should categorize validation errors', () => {
      expect(heuristicCategorize('invalid parameters provided')).toEqual({ type: 'VALIDATION_ERROR', category: 'validation' });
      expect(heuristicCategorize('ZodError: missing field')).toEqual({ type: 'VALIDATION_ERROR', category: 'validation' });
      expect(heuristicCategorize('validation failed')).toEqual({ type: 'VALIDATION_ERROR', category: 'validation' });
    });

    it('should categorize syntax errors', () => {
      expect(heuristicCategorize('You have an error in your SQL syntax')).toEqual({ type: 'SYNTAX_ERROR', category: 'query' });
    });

    it('should categorize permission errors', () => {
      expect(heuristicCategorize('Access denied for user')).toEqual({ type: 'PERMISSION_DENIED', category: 'permission' });
      expect(heuristicCategorize('needs to be performed by user with SUPER privilege')).toEqual({ type: 'PERMISSION_DENIED', category: 'permission' });
    });

    it('should categorize connection errors', () => {
      expect(heuristicCategorize('Lock wait timeout exceeded')).toEqual({ type: 'CONNECTION_ERROR', category: 'connection' });
      expect(heuristicCategorize("Can't connect to MySQL server")).toEqual({ type: 'CONNECTION_ERROR', category: 'connection' });
    });

    it('should categorize resource errors', () => {
      expect(heuristicCategorize('Table not found')).toEqual({ type: 'OBJECT_NOT_FOUND', category: 'resource' });
      expect(heuristicCategorize("Table doesn't exist")).toEqual({ type: 'OBJECT_NOT_FOUND', category: 'resource' });
      expect(heuristicCategorize('Table does not exist')).toEqual({ type: 'OBJECT_NOT_FOUND', category: 'resource' });
    });

    it('should fallback to internal tool error', () => {
      expect(heuristicCategorize('Some completely unknown weird error message')).toEqual({ type: 'TOOL_ERROR', category: 'internal' });
    });
  });
});
