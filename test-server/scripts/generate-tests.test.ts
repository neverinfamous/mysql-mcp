import { test, expect } from 'vitest';
import { TEST_FILES } from './test-manifest.js';
import { TOOL_GROUPS } from '../../src/filtering/tool-constants.js';

test('test-manifest is fully synchronized with TOOL_GROUPS SSoT', () => {
  const allValidTools = new Set(Object.values(TOOL_GROUPS).flat());
  
  for (const entry of TEST_FILES) {
    for (const tool of entry.tools) {
      expect(allValidTools.has(tool), `Tool '${tool}' in '${entry.filename}' does not exist in TOOL_GROUPS`).toBe(true);
    }
  }
});

test('test-manifest files actually exist in the file system', () => {
  import('fs').then(fs => {
    import('path').then(path => {
      const TEST_DIR = path.resolve('./test-server');
      for (const entry of TEST_FILES) {
        const fullPath = path.join(TEST_DIR, entry.directory, entry.filename);
        expect(fs.existsSync(fullPath), `File '${entry.filename}' does not exist at ${fullPath}`).toBe(true);
      }
    });
  });
});
