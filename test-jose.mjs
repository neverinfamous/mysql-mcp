import { createServer } from "node:http";
import * as jose from "jose";

async function run() {
  const JWKS_PORT = 3158;
  const keypair = await jose.generateKeyPair("RS256");
  const publicJwk = await jose.exportJWK(keypair.publicKey);
  publicJwk.kid = "scope-test-kid-1";
  publicJwk.use = "sig";
  publicJwk.alg = "RS256";

  const jwksServer = createServer((req, res) => {
    console.log("JWKS Server received request:", req.method, req.url);
    if (req.url === "/jwks") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ keys: [publicJwk] }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise((resolve) => {
    jwksServer.listen(JWKS_PORT, "127.0.0.1", () => {
      console.log("JWKS Server listening on 127.0.0.1:" + JWKS_PORT);
      resolve();
    });
  });

  console.log("Calling createRemoteJWKSet...");
  const JWKS = jose.createRemoteJWKSet(new URL(`http://127.0.0.1:${JWKS_PORT}/jwks`));
  
  console.log("Generating token...");
  const token = await new jose.SignJWT({ scope: "read" })
    .setProtectedHeader({ alg: "RS256", kid: "scope-test-kid-1" })
    .setIssuedAt()
    .setIssuer("urn:example:issuer")
    .setAudience("urn:example:audience")
    .setExpirationTime("1h")
    .sign(keypair.privateKey);

  console.log("Validating token...");
  try {
    const { payload, protectedHeader } = await jose.jwtVerify(token, JWKS, {
      issuer: "urn:example:issuer",
      audience: "urn:example:audience",
    });
    console.log("Success:", payload);
  } catch (e) {
    console.error("Failed:", e);
  }

  jwksServer.close();
}

run().catch(console.error);
