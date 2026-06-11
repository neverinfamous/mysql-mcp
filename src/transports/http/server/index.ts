import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { HttpTransportConfig } from "../types.js";
import { HttpTransport } from "./http-transport.js";

export { HttpTransport };

/**
 * Create an HTTP transport instance
 */
export function createHttpTransport(
  config: HttpTransportConfig,
  onConnect?: (transport: Transport) => void | Promise<void>,
): HttpTransport {
  return new HttpTransport(config, onConnect);
}
