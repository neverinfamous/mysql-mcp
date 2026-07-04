const fs = require('fs');

function replaceFile(path, replacer) {
  let code = fs.readFileSync(path, 'utf8');
  code = replacer(code);
  fs.writeFileSync(path, code);
}

replaceFile('src/adapters/mysql/tools/__tests__/vector.test.ts', code => {
  code = code.replace(/import \{ MySQLAdapter \} from "..\/..\/mysql-adapter\.js";\n/, '');
  code = code.replace(/const \{ query \} = /, 'const { } = ');
  return code;
});

replaceFile('src/adapters/mysql/tools/__tests__/versioning.test.ts', code => {
  code = code.replace(/import \{ MySQLAdapter \} from "..\/..\/mysql-adapter\.js";\n/, '');
  return code;
});

replaceFile('src/audit/__tests__/logger.test.ts', code => {
  code = code.replace(/, mkdir /, ' ');
  return code;
});

replaceFile('src/server/mcp-server/__tests__/resources.test.ts', code => {
  code = code.replace(/import \{ TOOL_GROUPS \} from "..\/..\/..\/constants\/instructions\.js";\n/, '');
  return code;
});

replaceFile('src/transports/http/server/__tests__/http-transport.test.ts', code => {
  code = code.replace(/const server = await requestHandler\(req, res\);/g, 'await requestHandler(req, res);');
  code = code.replace(/catch\(_e\)/g, 'catch()');
  return code;
});

console.log('Fixed');
