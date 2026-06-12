/**
 * mysql-mcp - Code Mode Worker Script
 *
 * This script runs in a worker thread to execute user code in isolation.
 * It uses Node.js vm module within the worker for additional sandboxing.
 *
 * API calls (mysql.*) are proxied over a MessagePort RPC bridge to the
 * main thread where the actual MySQLAdapter methods execute.
 */

import {
  isMainThread,
  parentPort,
  workerData,
  type MessagePort,
} from "node:worker_threads";
/**
 * @deprecated The worker-based sandbox is deprecated in favor of the 'isolate' mode using isolated-vm.
 * It will be removed in a future release.
 */
import vm from "node:vm";
import { transformAutoReturn } from "./auto-return.js";

interface WorkerData {
  code: string;
  apiBindings: Record<string, string[]>;
  timeout: number;
  rpcPort: MessagePort;
  maxResultSize: number;
}

interface WorkerResult {
  success: boolean;
  result?: unknown;
  error?: string | undefined;
  stack?: string | undefined;
}

interface RpcResponse {
  id: number;
  result?: unknown;
  error?: string;
}

/**
 * Build a proxy mysql object that forwards all method calls over the RPC port.
 * The apiBindings provide group → method name arrays from the main thread.
 * Each method becomes an async function that sends RPC and waits for response.
 */
export function buildMysqlProxy(
  bindings: Record<string, string[]>,
  rpcPort: MessagePort,
): Record<string, unknown> {
  const pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  let nextId = 0;

  // Listen for RPC responses from the main thread
  rpcPort.on("message", (msg: RpcResponse) => {
    const p = pending.get(msg.id);
    if (p) {
      pending.delete(msg.id);
      if (msg.error) {
        p.reject(new Error(msg.error));
      } else {
        p.resolve(msg.result);
      }
    }
  });

  const mysql: Record<string, unknown> = {};
  const groupNames: string[] = [];

  for (const [key, methods] of Object.entries(bindings)) {
    // Skip the special _topLevel key — handle separately below
    if (key === "_topLevel") continue;

    groupNames.push(key);

    const groupApi: Record<string, unknown> = {};
    for (const method of methods) {
      groupApi[method] = (...args: unknown[]): Promise<unknown> =>
        new Promise((resolve, reject) => {
          const id = nextId++;
          pending.set(id, { resolve, reject });
          rpcPort.postMessage({ id, group: key, method, args });
        });
    }

    mysql[key] = groupApi;
  }

  // Handle top-level aliases (e.g., readQuery, help)
  const topLevel = bindings["_topLevel"];
  if (topLevel) {
    for (const method of topLevel) {
      // Top-level aliases forward via _topLevel group
      mysql[method] = (...args: unknown[]): Promise<unknown> =>
        new Promise((resolve, reject) => {
          const id = nextId++;
          pending.set(id, { resolve, reject });
          rpcPort.postMessage({
            id,
            group: "_topLevel",
            method,
            args,
          });
        });
    }
  }

  return mysql;
}

/**
 * Run user code in a vm context within the worker thread
 */
export async function executeInWorker(): Promise<void> {
  const data = workerData as WorkerData;
  const { code, apiBindings, timeout, rpcPort } = data;

  try {
    // Start receiving RPC responses
    rpcPort.ref();

    // Build the mysql proxy object with RPC bridge
    const mysql = buildMysqlProxy(apiBindings, rpcPort);

    // Create sandbox context
    const sandbox: Record<string, unknown> = {
      mysql,
      console: {
        log: (): void => {
          /* intentionally empty */
        },
        error: (): void => {
          /* intentionally empty */
        },
        warn: (): void => {
          /* intentionally empty */
        },
        info: (): void => {
          /* intentionally empty */
        },
        debug: (): void => {
          /* intentionally empty */
        },
      },
      setTimeout: undefined,
      setInterval: undefined,
      setImmediate: undefined,
      process: undefined,
      require: undefined,
      __dirname: undefined,
      __filename: undefined,
      globalThis: undefined,
      global: undefined,
      Proxy: undefined,
    };

    const context = vm.createContext(sandbox, {
      name: "worker-sandbox",
      codeGeneration: { strings: false, wasm: false },
    });

    // Freeze built-in prototypes to prevent dynamic constructor chain escapes
    // e.g., Error().constructor.constructor('return process')()
    vm.runInContext(
      `
      [Object, Function, Array, String, Number, Boolean, RegExp, Date,
       Map, Set, WeakMap, WeakSet, Promise, Error, TypeError, RangeError,
       ReferenceError, SyntaxError, URIError, EvalError, ArrayBuffer,
       DataView, Float32Array, Float64Array, Int8Array, Int16Array,
       Int32Array, Uint8Array, Uint16Array, Uint32Array, Uint8ClampedArray,
      ].forEach(ctor => { if (ctor?.prototype) Object.freeze(ctor.prototype); });
      `,
      context,
    );

    // Wrap in async IIFE for top-level await
    const wrappedCode = `(async () => { ${transformAutoReturn(code)} })()`;

    const script = new vm.Script(wrappedCode, {
      filename: "user-code.js",
    });

    const result: unknown = await (script.runInContext(context, {
      timeout,
      displayErrors: true,
    }) as Promise<unknown>);

    // Close the RPC port before sending result
    rpcPort.unref();
    rpcPort.close();

    const response: WorkerResult = {
      success: true,
      result,
    };

    // Streaming egress boundary enforcement: abort serialization mid-flight
    // if the result exceeds maxResultSize. This prevents OOM from materializing
    // a multi-hundred-MB string before checking its length.
    const egressLimit = data.maxResultSize;
    try {
      let bytes = 0;
      const seen = new Set();

      JSON.stringify(result, (_key: string, value: unknown) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return "[Circular]";
          seen.add(value);
        }
        if (typeof value === "string") {
          bytes += Buffer.byteLength(value, "utf8") + 2; // include quotes
        } else if (typeof value === "number" || typeof value === "boolean") {
          bytes += Buffer.byteLength(String(value), "utf8");
        } else {
          bytes += 5; // brackets/keys/null overhead
        }

        if (bytes > egressLimit) {
          throw new Error(`EgressLimitExceeded:${String(bytes)}`);
        }
        return value;
      });
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.startsWith("EgressLimitExceeded:")
      ) {
        const actualBytesStr = err.message.split(":")[1];
        const actualBytes =
          actualBytesStr !== undefined
            ? Number(actualBytesStr)
            : egressLimit + 1;
        const actualKb = (actualBytes / 1024).toFixed(1);
        response.success = false;
        response.result = undefined;
        response.error = `Output limit exceeded: Result serialization exceeded the ${String(Math.round(egressLimit / 1024))}KB boundary (actual: >${actualKb}KB). Aggregate or filter results to reduce payload size.`;
      } else {
        response.success = false;
        response.result = undefined;
        response.error = `Result could not be serialized: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    parentPort?.postMessage(response);
  } catch (error) {
    // Close the RPC port before sending error
    rpcPort.unref();
    rpcPort.close();

    const response: WorkerResult = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };

    parentPort?.postMessage(response);
  }
}

// Run immediately when worker starts if not in main thread
if (!isMainThread) {
  void executeInWorker();
}
