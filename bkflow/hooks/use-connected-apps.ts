import { useQuery } from "@tanstack/react-query";

import type { ConnectorCatalog } from "@/lib/connectors/catalog-shared";

/** Trạng thái kết nối theo user (GET /api/connectors). Chỉ app có adapter đọc mới có mặt trong `apps`. */
export type ConnectorInventory = { configured: boolean; apps: Record<string, boolean> };

const getJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
};

export const useConnectedApps = () =>
  useQuery({
    queryKey: ["connectors"],
    queryFn: () => getJson<ConnectorInventory>("/api/connectors"),
    staleTime: 0,
    // Người dùng đăng nhập app ở tab khác rồi quay lại: tự cập nhật trạng thái.
    refetchOnWindowFocus: true,
  });

export const useConnectorCatalog = () =>
  useQuery({
    queryKey: ["connector-catalog"],
    queryFn: () => getJson<ConnectorCatalog>("/api/connectors/catalog"),
    staleTime: 10 * 60_000,
  });
