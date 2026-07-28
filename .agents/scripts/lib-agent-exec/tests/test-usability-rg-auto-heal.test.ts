import { expect, test, describe } from "bun:test";
import { systemInterceptor } from "../interceptors/system-interceptor.js";
import { ExecutionContext } from "../types.js";

describe("Usability Test: Ripgrep (rg) / Grep Auto-Healing", () => {
  test("Auto-heals rg without target directory on Windows by switching target to wsl2 and appending '.'", () => {
    const payload = {
      type: "command" as const,
      command: "rg",
      args: ["pattern_search"],
      timeoutMs: 5000,
      expectJsonEnvelope: false
    };

    const ctx: ExecutionContext = {
      cmdBasename: "rg",
      args: [...payload.args],
      envOverrides: {},
      payload
    };

    systemInterceptor(ctx);

    if (process.platform === "win32") {
      expect(ctx.payload.target).toBe("wsl2");
    }
    expect(ctx.args).toContain(".");
    expect(ctx.args.length).toBeGreaterThan(1);
  });

  test("Auto-heals rg with directory argument on Windows by switching target to wsl2", () => {
    const payload = {
      type: "command" as const,
      command: "rg",
      args: ["pattern_search", "."],
      timeoutMs: 5000,
      expectJsonEnvelope: false
    };

    const ctx: ExecutionContext = {
      cmdBasename: "rg",
      args: [...payload.args],
      envOverrides: {},
      payload
    };

    systemInterceptor(ctx);

    if (process.platform === "win32") {
      expect(ctx.payload.target).toBe("wsl2");
    }
    expect(ctx.args).toContain(".");
  });
});
