import { queryOptions, useQuery } from "@tanstack/react-query";
import superjson from "superjson";

export const viewQueryOptions = <T>(path: string, userId?: string | null) =>
  queryOptions({
    queryKey: userId === undefined ? ["view", path] : ["view", path, userId],
    staleTime: 30_000,
    queryFn: async ({ signal }): Promise<T> => {
      const res = await fetch(`/api/views${path}`, { credentials: "include", signal });
      if (!res.ok) throw Object.assign(new Error(`view ${path} ${res.status}`), { status: res.status });
      return superjson.parse<T>(await res.text());
    },
  });

export const useView = <T>(path: string, options?: { enabled?: boolean; userId?: string | null }) =>
  useQuery({ ...viewQueryOptions<T>(path, options?.userId), enabled: options?.enabled });
