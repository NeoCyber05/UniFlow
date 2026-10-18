// Route handlers still import Next-only modules. tsx compiles them to CJS (no "type": "module"),
// and module.register() hooks do not see CJS require(), so patch the CJS resolver instead.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const Module = createRequire(import.meta.url)("node:module");
const here = (file) => fileURLToPath(new URL(file, import.meta.url));

const map = {
  "server-only": here("./empty.ts"),
};

const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return original.call(this, map[request] ?? request, ...rest);
};
