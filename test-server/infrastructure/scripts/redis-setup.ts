import net from "node:net";

export async function setup() {
  const url = process.env.REDIS_URL || "redis://192.168.55.39:6379";
  let host = "localhost";
  let port = 6379;
  
  try {
    const parsed = new URL(url);
    host = parsed.hostname || "localhost";
    port = parseInt(parsed.port || "6379", 10);
  } catch {
    // ignore
  }

  // Redact password if present for logging
  const maskedUrl = url.replace(/:[^:@]*@/, ":***@");
  console.log(`[Vitest] Probing Redis availability at ${maskedUrl}...`);

  const available = await new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
    socket.connect(port, host);
  });

  if (available) {
    console.log(`[Vitest] Redis is available. Integration tests will run.`);
    process.env.REDIS_AVAILABLE = "true";
  } else {
    console.log(`[Vitest] Redis is NOT available. Integration tests will skip.`);
    process.env.REDIS_AVAILABLE = "false";
  }
}
