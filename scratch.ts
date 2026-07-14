
import { TEST_FILES } from "./test-server/scripts/test-manifest.js";
const codemode = TEST_FILES.filter(x => x.directory === "test-codemode");
console.log(codemode.map(x => x.filename).join("\n"));

