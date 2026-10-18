import "@fontsource-variable/inter";
import "@fontsource-variable/geist-mono";
import "./globals.css";

import * as Sentry from "@sentry/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { ClerkProvider } from "@clerk/react";
import { Toaster } from "sonner";

import { QueryProvider } from "@/components/providers/query-provider";

import { router } from "./router";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      routerPush={(to) => router.navigate(to)}
      routerReplace={(to) => router.navigate(to, { replace: true })}
    >
      <QueryProvider>
        <Toaster />
        <RouterProvider router={router} />
      </QueryProvider>
    </ClerkProvider>
  </StrictMode>,
);
