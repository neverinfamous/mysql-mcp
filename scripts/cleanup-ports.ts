import { execSync } from "node:child_process";
import os from "node:os";

const ports = [3002, 3101, 3160, 3161, 3162, 3163];

console.log(`[cleanup] Checking for orphaned test servers on ports: ${ports.join(", ")}...`);

for (const port of ports) {
  try {
    if (os.platform() === "win32") {
      // Find the PID listening on the port and kill it
      const cmd = `FOR /F "tokens=5" %a IN ('netstat -aon ^| findstr :${port}') DO taskkill /F /PID %a`;
      execSync(cmd, { stdio: "ignore" });
    } else {
      const cmd = `lsof -ti:${port} | xargs kill -9`;
      execSync(cmd, { stdio: "ignore" });
    }
  } catch (e) {
    // Ignore errors, port is likely free
  }
}

console.log(`[cleanup] Port cleanup complete.`);
