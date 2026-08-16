import { execSync } from "node:child_process";


const ports = [3101, 3103, 3160, 3161, 3162, 3163];

console.log(`[cleanup] Checking for orphaned test servers on ports: ${ports.join(", ")}...`);

for (const port of ports) {
  try {
      const cmd = `lsof -ti:${port} | xargs kill -9`;
      execSync(cmd, { stdio: "ignore" });
  } catch (e) {
    // Ignore errors, port is likely free
  }
}

console.log(`[cleanup] Port cleanup complete.`);
