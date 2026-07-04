const fs = require('fs');

function replaceFile(path, replacer) {
  let code = fs.readFileSync(path, 'utf8');
  code = replacer(code);
  fs.writeFileSync(path, code);
}

// 1. vector.test.ts
replaceFile('src/adapters/mysql/tools/__tests__/vector.test.ts', code => {
  code = code.replace(/import \{ MySQLAdapter \} from "..\/..\/mysql-adapter\.js";\n/, '');
  code = code.replace(/const \{ query \} = /, 'const { } = ');
  return code;
});

// 2. versioning.test.ts
replaceFile('src/adapters/mysql/tools/__tests__/versioning.test.ts', code => {
  code = code.replace(/import \{ MySQLAdapter \} from "..\/..\/mysql-adapter\.js";\n/, '');
  return code;
});

// 3. logger.test.ts
replaceFile('src/audit/__tests__/logger.test.ts', code => {
  code = code.replace(/, mkdir /, ' ');
  return code;
});

// 4. security.test.ts
replaceFile('src/codemode/__tests__/security.test.ts', code => {
  code = code.replace(/const mgr = /g, '');
  return code;
});

// 5. bindings.test.ts
replaceFile('src/codemode/api/mysql-api/__tests__/bindings.test.ts', code => {
  code = code.replace(/const bindings = /g, '');
  return code;
});

// 6. auth.test.ts
replaceFile('src/server/mcp-server/__tests__/auth.test.ts', code => {
  code = code.replace(/, ErrorCode/, '');
  return code;
});

// 7. resources.test.ts
replaceFile('src/server/mcp-server/__tests__/resources.test.ts', code => {
  code = code.replace(/import \{ logger \} from "..\/..\/..\/utils\/logger\.js";\n/, '');
  code = code.replace(/import \{ TOOL_GROUPS \} from "..\/..\/..\/constants\/instructions\.js";\n/, '');
  return code;
});

// 8. sdk-patch.test.ts
replaceFile('src/server/mcp-server/__tests__/sdk-patch.test.ts', code => {
  code = code.replace(/import \{ applySdkPatch \} from "..\/sdk-patch\.js";\n/, '');
  return code;
});

// 9. subscriptions.test.ts
replaceFile('src/server/mcp-server/__tests__/subscriptions.test.ts', code => {
  code = code.replace(/, ErrorCode/, '');
  return code;
});

// 10. http.test.ts
replaceFile('src/transports/http/__tests__/http.test.ts', code => {
  code = code.replace(/require\(/g, 'await import(');
  return code;
});

// 11. http-transport.test.ts
replaceFile('src/transports/http/server/__tests__/http-transport.test.ts', code => {
  code = code.replace(/const server = await requestHandler\(req, res\);/g, 'await requestHandler(req, res);');
  code = code.replace(/catch\(e\)/g, 'catch(_e)');
  return code;
});

// 12. sse.test.ts
replaceFile('src/transports/http/server/__tests__/sse.test.ts', code => {
  code = code.replace(/, ExtendedSSEServerTransport /, ' ');
  return code;
});

// 13. stream-utils.test.ts
replaceFile('src/utils/__tests__/stream-utils.test.ts', code => {
  code = code.replace(/, STREAM_CHUNK_SIZE /, ' ');
  return code;
});

console.log('Fixed');
