// Usage: npx tsx scripts/codemod-next-server.ts [--clerk]
import fs, { readFileSync, writeFileSync } from "node:fs";

// shortcut: @types/node is v20 (no globSync typing), runtime is Node 22; drop cast after upgrading @types/node.
const globSync = (fs as unknown as { globSync(pattern: string | string[], opts?: { cwd?: string }): string[] }).globSync;

const withClerk = process.argv.includes("--clerk");
const files = globSync(["server/routes/**/*.ts", "lib/**/*.ts", "actions/**/*.ts", "server/**/*.ts"]);
let changed = 0;

for (const file of files) {
  const before = readFileSync(file, "utf8");
  let src = before
    .replace(/^import \{[^}]*\} from "next\/server";\r?\n/m, "")
    .replace(/\bNextResponse\b/g, "Response")
    .replace(/\bNextRequest\b/g, "Request")
    .replace(/(\w+)\.nextUrl\.searchParams/g, "new URL($1.url).searchParams")
    .replace(/const \{ searchParams \} = (\w+)\.nextUrl;/g, "const { searchParams } = new URL($1.url);");

  if (withClerk) {
    src = src
      .replace(/from ["']@clerk\/nextjs\/server["']/g, 'from "@/server/auth"')
      .replace(/import \{ revalidatePath \} from "next\/cache";/g, 'import { revalidatePath } from "@/server/cache";');
  }

  if (src !== before) {
    writeFileSync(file, src);
    changed++;
  }
}
console.log(`codemod: ${changed} files changed`);
