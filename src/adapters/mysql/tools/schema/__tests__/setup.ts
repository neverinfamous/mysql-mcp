import { vi } from "vitest";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";

export function setupSchemaTest() {
  vi.clearAllMocks();
  const mockAdapter = createMockMySQLAdapter();
  const mockContext = createMockRequestContext();
  return { mockAdapter, mockContext };
}
