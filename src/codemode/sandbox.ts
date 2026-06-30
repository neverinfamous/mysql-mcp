/**
 * mysql-mcp - Code Mode Sandbox
 *
 * Sandboxed execution environment using isolated-vm.
 * Provides true V8 isolate separation for maximum security.
 */

import type ivm from "isolated-vm";
import * as acorn from "acorn";
import {
  DEFAULT_SANDBOX_OPTIONS,
  DEFAULT_POOL_OPTIONS,
  type SandboxOptions,
  type PoolOptions,
  type SandboxResult,
} from "./types.js";
import { transformAutoReturn } from "./auto-return.js";
import {
  ValidationError,
  PoolError,
} from "../types/modules/errors.js";

/**
 * A sandboxed execution context using isolated-vm
 */
const GROUP_NAME_REGEX = /^[a-zA-Z0-9_]+$/;
const astCache = new Map<string, acorn.Node>();
const MAX_AST_CACHE_SIZE = 500;

export class CodeModeSandbox {
  private readonly options: Required<SandboxOptions>;
  private disposed = false;
  private accumulatedLogs: string[] = [];

  private constructor(options: Required<SandboxOptions>) {
    this.options = options;
  }

  /**
   * Create a new sandbox instance
   */
  static create(options?: SandboxOptions): CodeModeSandbox {
    const opts: Required<SandboxOptions> = {
      ...DEFAULT_SANDBOX_OPTIONS,
      ...options,
    };
    return new CodeModeSandbox(opts);
  }

  /**
   * Execute code in the sandbox
   */
  async execute(
    code: string,
    apiBindings: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<SandboxResult> {
    if (this.disposed) {
      return {
        success: false,
        error: "Sandbox has been disposed",
        code: "INTERNAL_ERROR",
        category: "internal",
        recoverable: false,
        metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
      };
    }

    // Validate apiBindings group names to prevent injection
    for (const groupName of Object.keys(apiBindings)) {
      if (
        !GROUP_NAME_REGEX.test(groupName) ||
        groupName === "__proto__" ||
        groupName === "constructor" ||
        groupName === "prototype"
      ) {
        return {
          success: false,
          error: `Security Error: Invalid tool group name '${groupName}'`,
          code: "VALIDATION_ERROR",
          category: "validation",
          recoverable: false,
          metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
        };
      }
    }

    try {
      const wrappedCode = `async function __wrapper() { ${code} }`;
      if (!astCache.has(wrappedCode)) {
        const ast = acorn.parse(wrappedCode, {
          ecmaVersion: "latest",
          sourceType: "script",
        });
        const validateAst = (node: unknown): void => {
          if (node === null || node === undefined || typeof node !== "object")
            return;
          const n = node as Record<string, unknown>;
          if (n["type"] === "WithStatement") {
            throw new ValidationError(
              "'with' statements are forbidden in sandbox code.",
            );
          }
          if (
            n["type"] === "MemberExpression" &&
            n["object"] !== null &&
            n["object"] !== undefined &&
            typeof n["object"] === "object" &&
            (n["object"] as Record<string, unknown>)["type"] === "Identifier"
          ) {
            const objName = (n["object"] as Record<string, unknown>)[
              "name"
            ] as string;
            if (
              ["process", "require", "global", "globalThis"].includes(objName)
            ) {
              throw new ValidationError(`Access to '${objName}' is forbidden.`);
            }
          }
          for (const key in n) {
            if (key !== "loc" && key !== "start" && key !== "end") {
              validateAst(n[key]);
            }
          }
        };
        validateAst(ast);
        if (astCache.size >= MAX_AST_CACHE_SIZE) {
          const firstKey = astCache.keys().next().value;
          if (firstKey) astCache.delete(firstKey);
        }
        astCache.set(wrappedCode, ast);
      }
    } catch (e: unknown) {
      return {
        success: false,
        error:
          "Code validation failed: " +
          (e instanceof Error ? e.message : String(e)),
        code: "VALIDATION_ERROR",
        category: "validation",
        recoverable: false,
        metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
      };
    }

    const effectiveTimeout = timeoutMs ?? this.options.timeoutMs;
    let ivmLib: typeof ivm | null = null;
    try {
      await SandboxPool.initialize();
      ivmLib = SandboxPool.getIvmLib();
    } catch {
      // Fallback to node:vm if isolated-vm is broken/missing
    }

    if (!ivmLib) {
      return {
        success: false,
        error: "Security Error: isolated-vm native bindings failed to load. Code Mode strict isolation is enabled and node:vm fallback is prohibited.",
        code: "INTERNAL_ERROR",
        category: "internal",
        recoverable: false,
        metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
      };

    }

    const isolate = new ivmLib.Isolate({
      memoryLimit: this.options.memoryLimitMb,
    });

    let context: ivm.Context | undefined;
    let logRef: ivm.Reference<unknown> | undefined;
    let script: ivm.Script | undefined;
    const refCleanup: ivm.Reference<unknown>[] = [];
    const logs: string[] = [];

    const startTime = performance.now();
    let result: unknown;
    let success = true;
    let errorMsg: string | undefined;

    try {
      context = isolate.createContextSync();
      const jail = context.global;
      jail.setSync("global", jail.derefInto());

      logRef = new ivmLib.Reference((level: string, ...args: unknown[]) => {
        const msg = args
          .map((a) =>
            typeof a === "object" && a !== null ? JSON.stringify(a) : String(a),
          )
          .join(" ");
        logs.push(level === "LOG" ? msg : `[${level}] ${msg}`);
      });

      context.global.setSync("logRef", logRef);
      const setupScript = `
        globalThis.console = {
          log: (...args) => logRef.applyIgnored(undefined, ['LOG', ...args], { arguments: { copy: true } }),
          error: (...args) => logRef.applyIgnored(undefined, ['ERROR', ...args], { arguments: { copy: true } }),
          warn: (...args) => logRef.applyIgnored(undefined, ['WARN', ...args], { arguments: { copy: true } }),
          info: (...args) => logRef.applyIgnored(undefined, ['INFO', ...args], { arguments: { copy: true } }),
          debug: (...args) => logRef.applyIgnored(undefined, ['DEBUG', ...args], { arguments: { copy: true } })
        };
        
        globalThis.wrapResult = function(result) {
            if (result !== null && result !== undefined && typeof result === 'object') {
                const isFailed = 'success' in result && result.success === false;
                if (isFailed) {
                    return new Proxy(result, {
                        get(target, prop) {
                            if (prop in target) return target[prop];
                            if (typeof prop === 'string' && !['then', 'catch', 'finally', 'constructor', 'prototype', 'toJSON', 'isError'].includes(prop)) {
                                const errVal = target.error;
                                const errorMsg = typeof errVal === 'string' ? errVal : 'Unknown error';
                                throw new Error("Attempted to access missing property '" + prop + "' on a failed operation. API Error: " + errorMsg);
                            }
                            return undefined;
                        }
                    });
                }
                
                if (!Array.isArray(result)) {
                    return new Proxy(result, {
                        get(target, prop) {
                            if (prop in target) return target[prop];
                            
                            const searchObj = (target.data && typeof target.data === 'object') ? target.data : target;
                            
                            if (typeof prop === 'string' && prop in searchObj) {
                                return searchObj[prop];
                            }
                            
                            if (prop === Symbol.iterator) {
                                const arrayKeys = Object.keys(searchObj).filter(k => Array.isArray(searchObj[k]));
                                const targetKey = arrayKeys.find(k => ['rows', 'columns', 'tables', 'results', 'items', 'entries', 'keys'].includes(k)) || arrayKeys[0];
                                if (targetKey !== undefined) {
                                    return function* () {
                                        yield* searchObj[targetKey];
                                    };
                                }
                            }
                            
                            if (typeof prop === 'string' && ['map', 'filter', 'reduce', 'forEach', 'find', 'some', 'every', 'flatMap', 'slice', 'length'].includes(prop)) {
                                const arrayKeys = Object.keys(searchObj).filter(k => Array.isArray(searchObj[k]));
                                const targetKey = arrayKeys.find(k => ['rows', 'columns', 'tables', 'results', 'items', 'entries', 'keys'].includes(k)) || arrayKeys[0];
                                if (targetKey !== undefined) {
                                    const arr = searchObj[targetKey];
                                    if (prop === 'length') return arr.length;
                                    const method = arr[prop];
                                    if (typeof method === 'function') {
                                        return (...args) => method.apply(arr, args);
                                    }
                                }
                                const keys = Object.keys(searchObj).join(', ') || 'none';
                                throw new TypeError("CodeMode Non-Array Proxy Error: Attempted to call Array method '" + prop + "' on an Object. The returned result is not an Array, and no array properties could be automatically resolved. Keys available: " + keys + ". Target JSON: " + JSON.stringify(target));
                            }
                            return undefined;
                        }
                    });
                }
            }
            return result;
        };
        
        globalThis.wrapPromise = function(promise, methodName) {
            return new Proxy(promise, {
                get(target, prop) {
                    if (prop === 'then') return target.then.bind(target);
                    if (prop === 'catch') return target.catch.bind(target);
                    if (prop === 'finally') return target.finally.bind(target);
                    if (typeof prop === 'string' && !['constructor', 'toString', 'valueOf', 'toJSON'].includes(prop)) {
                        throw new Error("Attempted to access property '" + prop + "' on a Promise object. Did you forget to 'await' the tool call? (e.g. const result = await mysql.group." + methodName + "(...))");
                    }
                    return Reflect.get(target, prop);
                }
            });
        };

        globalThis.mysql = {};
      `;
      context.evalSync(setupScript);
      
      context.evalSync(`
        globalThis.__sandbox_replacer = function(k, v) {
          if (this[k] instanceof Uint8Array) {
            return { type: 'Buffer', data: Array.from(this[k]) };
          }
          return v;
        };
      `);

      let rpcCount = 0;
      // Security (CWE-400): Limit host tool calls per execution to prevent
      // malicious code from flooding the host via rapid RPC requests.
      const MAX_RPC_CALLS = 1000;

      // Inject apiBindings
      const reviveBuffers = (obj: unknown): unknown => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map((item) => reviveBuffers(item));
        const record = obj as Record<string, unknown>;
        if (record['type'] === 'Buffer' && Array.isArray(record['data'])) {
          return Buffer.from(record['data'] as number[]);
        }
        const revived: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(record)) {
          revived[k] = reviveBuffers(v);
        }
        return revived;
      };

      let batchedScript = "";
      for (const [groupName, groupValue] of Object.entries(apiBindings)) {
        if (typeof groupValue === "object" && groupValue !== null) {
          batchedScript += `globalThis.mysql[${JSON.stringify(groupName)}] = {};\n`;
          for (const [methodName, methodFn] of Object.entries(groupValue)) {
            if (typeof methodFn === "function") {
              const fnRef = new ivmLib.Reference(async (...args: unknown[]) => {
                try {
                  if (++rpcCount > MAX_RPC_CALLS) {
                    return {
                      __isHostError: true,
                      message: `RateLimitError: QuotaExceededError: Maximum number of host tool calls (${MAX_RPC_CALLS}) exceeded (attempted call ${rpcCount}).`
                    };
                  }
                  const res = await (
                    methodFn as (...args: unknown[]) => Promise<unknown>
                  )(...(reviveBuffers(args) as unknown[]));
                  return res;
                } catch (e) {
                  return {
                    __isHostError: true,
                    message: e instanceof Error ? e.message : String(e)
                  };
                }
              });
              refCleanup.push(fnRef);
              const refName = `fnRef_${groupName}_${methodName}`;
              context.global.setSync(refName, fnRef);
              batchedScript += `globalThis.mysql[${JSON.stringify(groupName)}][${JSON.stringify(methodName)}] = (...args) => {
                  const safeArgs = JSON.parse(JSON.stringify(args, globalThis.__sandbox_replacer));
                  const promise = globalThis[${JSON.stringify(refName)}].apply(undefined, safeArgs, { arguments: { copy: true }, result: { promise: true, copy: true } }).then(res => {
                      if (res && typeof res === 'object' && res.__isHostError) {
                          throw new Error(res.message);
                      }
                      return globalThis.wrapResult(res);
                  });
                  return globalThis.wrapPromise(promise, ${JSON.stringify(methodName)});
                };\n`;
            }
          }
        } else if (typeof groupValue === "function") {
          const fnRef = new ivmLib.Reference(async (...args: unknown[]) => {
            try {
              if (++rpcCount > MAX_RPC_CALLS) {
                return {
                  __isHostError: true,
                  message: `RateLimitError: QuotaExceededError: Maximum number of host tool calls (${MAX_RPC_CALLS}) exceeded (attempted call ${rpcCount}).`
                };
              }
              const res = await (
                groupValue as (...args: unknown[]) => Promise<unknown>
              )(...(reviveBuffers(args) as unknown[]));
              return res;
            } catch (e) {
              return {
                __isHostError: true,
                message: e instanceof Error ? e.message : String(e)
              };
            }
          });
          refCleanup.push(fnRef);
          const refName = `fnRef_${groupName}`;
          context.global.setSync(refName, fnRef);
          batchedScript += `globalThis.mysql[${JSON.stringify(groupName)}] = (...args) => {
              const safeArgs = JSON.parse(JSON.stringify(args, globalThis.__sandbox_replacer));
              const promise = globalThis[${JSON.stringify(refName)}].apply(undefined, safeArgs, { arguments: { copy: true }, result: { promise: true, copy: true } }).then(res => {
                  if (res && typeof res === 'object' && res.__isHostError) {
                      throw new Error(res.message);
                  }
                  return globalThis.wrapResult(res);
              });
              return globalThis.wrapPromise(promise, ${JSON.stringify(groupName)});
            };\n`;
        }
      }
      
      if (batchedScript.length > 0) {
        context.evalSync(batchedScript);
      }

      context.evalSync(`
        const proxyHandler = {
          get(target, prop, receiver) {
            if (typeof prop === "string" && !(prop in target)) {
              const camelProp = prop.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
              if (camelProp in target) {
                return Reflect.get(target, camelProp, receiver);
              }
            }
            return Reflect.get(target, prop, receiver);
          }
        };
        globalThis.mysql = new Proxy(globalThis.mysql, proxyHandler);
        for (const key of Object.keys(globalThis.mysql)) {
          if (typeof globalThis.mysql[key] === "object" && globalThis.mysql[key] !== null) {
            globalThis.mysql[key] = new Proxy(globalThis.mysql[key], proxyHandler);
          }
        }
      `);

      const wrappedCode = `(async () => { 
        try {
          const __sandbox_result = await (async () => { ${transformAutoReturn(code)} })();
          const __sandbox_str = JSON.stringify(__sandbox_result, globalThis.__sandbox_replacer);
          return { __isIsolateSuccess: true, data: __sandbox_str === undefined ? undefined : JSON.parse(__sandbox_str) };
        } catch (e) {
          return { __isIsolateSuccess: false, message: e && e.message ? String(e.message) : String(e) };
        }
      })()`;
      script = isolate.compileScriptSync(wrappedCode, {
        filename: `code-mode.js`,
      });
      const isolateRes = (await script.run(context, {
        timeout: effectiveTimeout,
        promise: true,
        copy: true,
      })) as { __isIsolateSuccess?: boolean; data?: unknown; message?: string } | undefined;
      if (isolateRes?.__isIsolateSuccess === false) {
        throw new Error(isolateRes.message ?? "Unknown isolate error");
      }
      result = isolateRes?.__isIsolateSuccess ? isolateRes.data : isolateRes;
    } catch (error: unknown) {
      success = false;
      errorMsg = error instanceof Error ? error.message : String(error);
    } finally {
      // Cleanup references and isolate robustly
      for (const ref of refCleanup) {
        try {
          ref.release();
        } catch {
          /* ignore */
        }
      }
      try {
        logRef?.release();
      } catch {
        /* ignore */
      }
      try {
        script?.release();
      } catch {
        /* ignore */
      }
      try {
        context?.release();
      } catch {
        /* ignore */
      }
      try {
        isolate.dispose();
      } catch {
        /* ignore */
      }
    }

    const endTime = performance.now();

    this.accumulatedLogs.push(...logs);

    return {
      success,
      ...(success ? { result } : { 
        error: errorMsg,
        code: "EXECUTION_ERROR",
        category: "execution",
        recoverable: false
      }),
      logs,
      metrics: {
        wallTimeMs: Math.round(endTime - startTime),
        cpuTimeMs: Math.round(endTime - startTime),
        memoryUsedMb: 0,
      },
    };
  }

  getConsoleOutput(): string[] {
    return [...this.accumulatedLogs];
  }

  clearConsoleOutput(): void {
    this.accumulatedLogs = [];
  }

  isHealthy(): boolean {
    return !this.disposed;
  }

  dispose(): void {
    this.disposed = true;
    this.accumulatedLogs = [];
  }
}

/**
 * Pool of sandbox instances for reuse
 */
export class SandboxPool {
  private readonly options: Required<PoolOptions>;
  private readonly sandboxOptions: Required<SandboxOptions>;
  private inUseCount = 0;
  private readonly idlePool: CodeModeSandbox[] = [];
  private static ivmPromise: Promise<typeof ivm> | null = null;
  private static cachedIvmLib: typeof ivm | null = null;

  constructor(poolOptions?: PoolOptions, sandboxOptions?: SandboxOptions) {
    this.options = { ...DEFAULT_POOL_OPTIONS, ...poolOptions };
    this.sandboxOptions = { ...DEFAULT_SANDBOX_OPTIONS, ...sandboxOptions };
  }

  static getIvmLib(): typeof ivm {
    if (!SandboxPool.cachedIvmLib) {
      throw new Error("ivmLib not initialized");
    }
    return SandboxPool.cachedIvmLib;
  }

  static async initialize(): Promise<void> {
    SandboxPool.ivmPromise ??= import("isolated-vm")
      .then((m) => m.default)
      .catch(() => null as unknown as typeof ivm);
    const lib = await SandboxPool.ivmPromise;
    if (lib !== null) {
      SandboxPool.cachedIvmLib = lib;
    }
  }

  async initialize(): Promise<void> {
    await SandboxPool.initialize();
  }

  async execute(
    code: string,
    apiBindings: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<SandboxResult> {
    if (!SandboxPool.cachedIvmLib) {
      await SandboxPool.initialize();
    }

    if (this.inUseCount >= this.options.maxInstances) {
      throw new PoolError(
        `Sandbox pool exhausted (max ${this.options.maxInstances})`
      );
    }

    this.inUseCount++;
    let sandbox = this.idlePool.pop();

    if (sandbox === undefined) {
      sandbox = CodeModeSandbox.create(this.sandboxOptions);
    } else {
      sandbox.clearConsoleOutput();
    }

    try {
      return await sandbox.execute(code, apiBindings, timeoutMs);
    } finally {
      this.inUseCount--;
      if (this.idlePool.length < 4 && sandbox.isHealthy()) {
        this.idlePool.push(sandbox);
      } else {
        sandbox.dispose();
      }
    }
  }

  cleanup(): void {
    for (const sandbox of this.idlePool) {
      sandbox.dispose();
    }
    this.idlePool.length = 0;
  }

  getStats(): { available: number; inUse: number; max: number; idle: number } {
    return {
      available: Math.max(0, this.options.maxInstances - this.inUseCount),
      inUse: this.inUseCount,
      max: this.options.maxInstances,
      idle: this.idlePool.length,
    };
  }

  dispose(): void {
    this.cleanup();
  }
}
