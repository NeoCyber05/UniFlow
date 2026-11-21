"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useAuth } from "@/web/lib/auth";
import { isUnavailableViewError } from "@/lib/fetcher";

export const QueryProvider = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const { userId } = useAuth();
  return <AccountQueries key={userId ?? "signed-out"}>{children}</AccountQueries>;
};

const AccountQueries = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => !isUnavailableViewError(error) && failureCount < 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};
