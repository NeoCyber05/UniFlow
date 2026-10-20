import "@fontsource-variable/inter";
import "@fontsource-variable/geist-mono";
import "./globals.css";

import * as Sentry from "@sentry/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { Toaster } from "sonner";

import { QueryProvider } from "@/components/providers/query-provider";
import { LocaleBoundary } from "@/lib/i18n";

import { router } from "./router";
import { installAuthFetch } from "./lib/auth-fetch";
import { AuthProvider } from "./lib/auth";
import { supabaseConfigured } from "./lib/supabase";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

// A deploy removes the old lazy route chunks; a tab opened before it reloads to get the new index.html.
window.addEventListener("vite:preloadError", () => window.location.reload());

installAuthFetch();
const root = createRoot(document.getElementById("root")!);
if (!supabaseConfigured) {
  root.render(
    <p style={{ padding: 24, fontFamily: "sans-serif" }}>
      Thiếu NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY khi build. Đặt biến trên Railway rồi redeploy.
    </p>,
  );
} else root.render(
  <StrictMode>
    <AuthProvider>
      <QueryProvider>
        <Toaster />
        <LocaleBoundary>
          <RouterProvider router={router} />
        </LocaleBoundary>
      </QueryProvider>
    </AuthProvider>
  </StrictMode>,
);
