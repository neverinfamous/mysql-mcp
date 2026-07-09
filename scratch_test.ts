import { buildSandboxBindings } from "./src/codemode/api/mysql-api/bindings.js";

const fakeApi = {
  core: {
    enableVersioning: async (p) => ({ success: true, enable: p }),
    disableVersioning: async (p) => ({ success: true, disable: p }),
    checkVersion: async (p) => ({ success: true, check: p }),
    conditionalUpdate: async (p) => ({ success: true, update: p }),
  },
  help: () => ({ success: true })
};

const bindings = buildSandboxBindings(fakeApi as any, false);
console.log("Versioning group exists:", !!bindings.versioning);
if (bindings.versioning) {
  console.log("enable:", !!bindings.versioning.enable);
}
