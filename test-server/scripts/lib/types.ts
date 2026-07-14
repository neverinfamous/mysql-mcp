export type TestDirectory = 'test-tool-groups' | 'test-codemode' | 'test-advanced' | 'test-usability' | 'test-usability-direct';

export interface DirectoryConfig {
  titleType: string;
  executionMode: string;
  coverageMatrixHeaders: string[];
  commitScope: string;
  useCodeModeNamespace: boolean;
}

export interface TestFileEntry {
  filename: string;
  directory: TestDirectory;
  group: string;
  tools: string[];
  contentPartial?: string;
  executionModeOverride?: string;
}
