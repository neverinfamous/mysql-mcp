/**
 * mysql-mcp - Auth Context
 *
 * Per-request authentication context threading using AsyncLocalStorage.
 * Allows tool handlers to access auth context without direct parameter coupling.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { AuthenticatedContext } from "./middleware.js";

const authStore = new AsyncLocalStorage<AuthenticatedContext>();

/**
 * Run a callback with an auth context bound to the current async scope.
 */
export function runWithAuthContext<T>(
  context: AuthenticatedContext,
  callback: () => T,
): T {
  return authStore.run(context, callback);
}

/**
 * Get the current auth context from the async scope.
 * Returns undefined if no context is active.
 */
export function getAuthContext(): AuthenticatedContext | undefined {
  return authStore.getStore();
}
