import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";

// Mock worker_threads module before import
const { mockParentPort, mockRpcPort } = vi.hoisted(() => {
  class FakeEventEmitter {
    listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    on(event: string, fn: (...args: unknown[]) => void) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(fn);
    }
    emit(event: string, data: unknown) {
      if (this.listeners[event]) {
        this.listeners[event].forEach((fn) => fn(data));
      }
    }
    removeAllListeners() {
      this.listeners = {};
    }
  }

  const mockParentPort = { postMessage: vi.fn() };
  const mockRpcPort = new FakeEventEmitter() as unknown as MessagePort;
  mockRpcPort.postMessage = vi.fn();
  mockRpcPort.ref = vi.fn();
  mockRpcPort.unref = vi.fn();
  mockRpcPort.close = vi.fn();
  return { mockParentPort, mockRpcPort };
});

vi.mock("node:worker_threads", () => ({
  isMainThread: true, // Prevents auto-execution on import
  parentPort: mockParentPort,
  workerData: {
    code: 'return "hello"',
    apiBindings: {
      core: ["readQuery"],
      _topLevel: ["readQuery"],
    },
    timeout: 5000,
    rpcPort: mockRpcPort,
  },
  MessageChannel: class {
    port1 = new EventEmitter();
    port2 = new EventEmitter();
    constructor() {
      (this.port1 as unknown as { close: ReturnType<typeof vi.fn> }).close = vi.fn();
      (this.port2 as unknown as { close: ReturnType<typeof vi.fn> }).close = vi.fn();
    }
  },
}));

// Now we can import the actual module
import { buildMysqlProxy, executeInWorker } from "../worker-script.js";

describe("Worker Script", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpcPort.removeAllListeners();
  });

  describe("buildMysqlProxy", () => {
    it("should build proxy that sends RPC messages", async () => {
      const bindings = {
        core: ["readQuery", "writeQuery"],
        _topLevel: ["readQuery"],
      };

      const proxy = buildMysqlProxy(bindings, mockRpcPort);

      expect(proxy).toHaveProperty("core");
      expect(proxy).toHaveProperty("readQuery");

      // Test RPC method call
      const promise = proxy.core.readQuery("SELECT 1");

      expect(mockRpcPort.postMessage).toHaveBeenCalledWith({
        id: expect.any(Number),
        group: "core",
        method: "readQuery",
        args: ["SELECT 1"],
      });

      // Simulate response
      const callArgs = mockRpcPort.postMessage.mock.calls[0][0];
      mockRpcPort.emit("message", { id: callArgs.id, result: "success" });

      const result = await promise;
      expect(result).toBe("success");
    });

    it("should handle top-level methods", async () => {
      const bindings = { _topLevel: ["readQuery"] };
      const proxy = buildMysqlProxy(bindings, mockRpcPort);

      const promise = proxy.readQuery("SELECT 1");
      const callArgs = mockRpcPort.postMessage.mock.calls[0][0];
      expect(callArgs.group).toBe("_topLevel");

      mockRpcPort.emit("message", { id: callArgs.id, error: "failed" });
      await expect(promise).rejects.toThrow("failed");
    });
  });

  describe("executeInWorker", () => {
    it("should execute code and post result", async () => {
      await executeInWorker();

      expect(mockParentPort.postMessage).toHaveBeenCalledWith({
        success: true,
        result: "hello",
      });
      expect(mockRpcPort.ref).toHaveBeenCalled();
      expect(mockRpcPort.unref).toHaveBeenCalled();
      expect(mockRpcPort.close).toHaveBeenCalled();
    });

    it("should catch errors and post failure", async () => {
      // Temporarily change code to something that throws
      const { workerData } = await import("node:worker_threads");
      workerData.code = "throw new Error('test error');";

      await executeInWorker();

      expect(mockParentPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("test error"),
        }),
      );
    });
  });
});
