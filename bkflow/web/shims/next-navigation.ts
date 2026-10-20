/* eslint-disable @typescript-eslint/no-unused-vars -- Next API parity: accepted-but-ignored args */
import { useMemo } from "react";
import { useLocation, useNavigate, useParams as useRRParams, useSearchParams as useRRSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

import { invalidateAfterWrite } from "@/lib/invalidate-after-write";

export const useRouter = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      push: (href: string, _opts?: { scroll?: boolean }) => navigate(href),
      replace: (href: string, _opts?: { scroll?: boolean }) => navigate(href, { replace: true }),
      back: () => navigate(-1),
      forward: () => navigate(1),
      // Server-rendered data now lives in TanStack Query, so "refresh" = refetch active queries.
      refresh: () => invalidateAfterWrite(queryClient),
      prefetch: (_href: string) => {},
    }),
    [navigate, queryClient],
  );
};

export const usePathname = () => useLocation().pathname;
export const useSearchParams = () => useRRSearchParams()[0];
export const useParams = <T extends Record<string, string>>() => useRRParams() as T;

export type AppRouterInstance = ReturnType<typeof useRouter>;
