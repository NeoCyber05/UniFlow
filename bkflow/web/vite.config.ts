import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { serverActionsPlugin } from "./plugins/server-actions";

const root = path.resolve(__dirname, "..");
const PUBLIC_ENV = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_PUSHER_CLUSTER",
  "NEXT_PUBLIC_PUSHER_KEY",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_UNSPLASH_ACCESS_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  return {
    root: __dirname,
    publicDir: path.join(root, "public"),
    envDir: root,
    plugins: [serverActionsPlugin(root), react(), tailwindcss()],
    // Keep existing `process.env.NEXT_PUBLIC_*` reads working without touching call sites.
    define: Object.fromEntries(PUBLIC_ENV.map((k) => [`process.env.${k}`, JSON.stringify(env[k] ?? "")])),
    resolve: {
      alias: [
        // @prisma/client/index-browser requires ".prisma/client/index-browser", which Rollup leaves as a bare import (blank page in prod).
        { find: /^\.prisma\/client\/index-browser$/, replacement: path.join(root, "node_modules/.prisma/client/index-browser.js") },
        { find: /^next\/font\/(google|local)$/, replacement: path.join(__dirname, "shims/next-font.ts") },
        { find: /^next\/image$/, replacement: path.join(__dirname, "shims/next-image.tsx") },
        { find: /^next\/link$/, replacement: path.join(__dirname, "shims/next-link.tsx") },
        { find: /^next\/navigation$/, replacement: path.join(__dirname, "shims/next-navigation.ts") },
        { find: /^@\//, replacement: root + "/" },
      ],
    },
    server: {
      port: 5173,
      proxy: { "/api": "http://localhost:4000" },
    },
    build: { outDir: path.join(root, "web/dist"), emptyOutDir: true },
  };
});
