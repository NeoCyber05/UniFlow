import { useQuery } from "@tanstack/react-query";
import superjson from "superjson";

export const useView = <T>(path: string, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ["view", path],
    enabled: options?.enabled,
    queryFn: async (): Promise<T> => {
      const res = await fetch(`/api/views${path}`, { credentials: "include" });
      if (!res.ok) throw Object.assign(new Error(`view ${path} ${res.status}`), { status: res.status });
      return superjson.parse<T>(await res.text());
    },
  });
