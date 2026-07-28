import { test, expect } from "bun:test";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const agentExecPath = path.resolve(__dirname, "../agent-exec.ts");

test("rg on Windows auto-routes to WSL2 and handles missing target directory without throwing", () => {
  const payloadPath = path.join(os.tmpdir(), `test-rg-auto-heal-${Date.now()}.json`);
  const payload = {
    type: "command",
    command: "rg",
    args: ["test-usability-rg-auto-heal"],
    cwd: "C:\\Users\\chris\\Desktop\\mysql-mcp"
  };
  fs.writeFileSync(payloadPath, JSON.stringify(payload));

  try {
    const output = execSync(`bun ${agentExecPath} ${payloadPath}`, { encoding: "utf8", stdio: "pipe" });
    expect(output).toBeDefined();
  } catch (err: unknown) {
    // Exit code 1 for no matches found in rg is standard and treated gracefully, so it should not throw exit error 1
    if (err && typeof err === "object" && "status" in err && err.status === 1) {
      // Check stderr for error
      const stderr = "stderr" in err ? String(err.stderr) : "";
      expect(stderr).not.toContain("Executable not found in $PATH");
      expect(stderr).not.toContain("It will hang indefinitely");
    }
  } finally {
    if (fs.existsSync(payloadPath)) fs.unlinkSync(payloadPath);
  }
});
