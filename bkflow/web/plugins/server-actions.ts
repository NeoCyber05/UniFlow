import { readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const PREFIX = "\0server-action:";

export const actionKeyFromId = (id: string) => id.match(/^@\/actions\/([\w-]+\/[\w-]+)$/)?.[1] ?? null;

export const stubSource = (key: string, name: string) =>
  `import { callAction } from "@/web/lib/call-action";\nexport const ${name} = callAction("${key}");\n`;

/** Never bundle server action code (Prisma, secrets) into the SPA: replace it with a fetch stub. */
export const serverActionsPlugin = (root: string): Plugin => ({
  name: "hustflow-server-actions",
  enforce: "pre",
  resolveId(id) {
    // Vite's alias plugin runs first and has already turned "@/" into the absolute root.
    const key = actionKeyFromId(id.startsWith(root + "/") ? "@/" + id.slice(root.length + 1) : id);
    return key ? PREFIX + key : null;
  },
  load(id) {
    if (!id.startsWith(PREFIX)) return null;
    const key = id.slice(PREFIX.length);
    const src = readFileSync(path.join(root, "actions", key, "index.ts"), "utf8");
    const name = src.match(/export const (\w+) = createSafeAction/)?.[1];
    if (!name) this.error(`actions/${key}/index.ts: no "export const X = createSafeAction"`);
    return stubSource(key, name);
  },
});
