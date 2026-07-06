/**
 * mysql-mcp - Sandbox Factory
 *
 * Factory functions for creating sandbox instances.
 * Note: Only 'isolate' mode is supported. Worker mode was disabled for security.
 */

import { CodeModeSandbox, SandboxPool } from "./sandbox.js";
import { logger } from "../utils/logger.js";
import type { SandboxOptions, PoolOptions, SandboxResult } from "./types.js";

/**
 * Sandbox isolation mode
 */
export type SandboxMode = "isolate";

/**
 * Unified sandbox interface
 */
export interface ISandbox {
  execute(
    code: string,
    apiBindings: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<SandboxResult>;
  isHealthy(): boolean;
  dispose(): void;
}

/**
 * Unified sandbox pool interface
 */
export interface ISandboxPool {
  initialize(): Promise<void>;
  execute(
    code: string,
    apiBindings: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<SandboxResult>;
  getStats(): { available: number; inUse: number; max: number; idle?: number };
  dispose(): void;
}

/**
 * Mode info for documentation/selection
 */
export interface SandboxModeInfo {
  name: string;
  isolation: string;
  performance: string;
  security: string;
  requirements: string;
}

// Default mode (module-level state)
let defaultMode: SandboxMode = "isolate";

/**
 * Set the default sandbox mode
 */
export function setDefaultSandboxMode(mode: string): void {
  if (mode !== "isolate") {
    throw new Error("Only 'isolate' mode is supported. Worker and vm modes were disabled for security.");
  }
  defaultMode = "isolate";
  logger.info(`Sandbox default mode set to: ${mode}`, {
    module: "CODEMODE" as const,
  });
}

/**
 * Get the current default mode
 */
export function getDefaultSandboxMode(): SandboxMode {
  return defaultMode;
}

/**
 * Get available sandbox modes
 */
export function getAvailableSandboxModes(): SandboxMode[] {
  return ["isolate"];
}

/**
 * Create a sandbox instance
 * @param mode - Isolation mode ('isolate')
 * @param options - Sandbox options
 */
export function createSandbox(
  mode?: string,
  options?: SandboxOptions,
): ISandbox {
  if (mode && mode !== "isolate") {
    throw new Error("Only 'isolate' mode is supported. Worker and vm modes were disabled for security.");
  }
  return CodeModeSandbox.create(options);
}

/**
 * Create a sandbox pool
 * @param mode - Isolation mode ('isolate')
 * @param poolOptions - Pool configuration
 * @param sandboxOptions - Sandbox configuration
 */
export function createSandboxPool(
  mode?: string,
  poolOptions?: PoolOptions,
  sandboxOptions?: SandboxOptions,
): ISandboxPool {
  if (mode && mode !== "isolate") {
    throw new Error("Only 'isolate' mode is supported. Worker and vm modes were disabled for security.");
  }
  return new SandboxPool(poolOptions, sandboxOptions);
}

/**
 * Get mode characteristics for documentation/selection
 */
export function getSandboxModeInfo(mode: string): SandboxModeInfo {
  if (mode !== "isolate") {
    throw new Error("Only 'isolate' mode is supported.");
  }
  return {
    name: "Native Isolate",
    isolation: "True V8 memory separation via C++ boundary",
    performance: "Low overhead, reusable isolates via pool",
    security: "Maximum - isolated memory, strict timeout, AST validation",
    requirements: "isolated-vm native addon",
  };
}
