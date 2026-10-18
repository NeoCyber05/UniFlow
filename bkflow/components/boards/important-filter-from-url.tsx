"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "@/web/shims/next-navigation";

import { useBoardFilters } from "@/hooks/use-board-filters";

/** `/board/<id>/...?important=1` (từ link /my/important cũ) → bật lọc ⭐ rồi xoá param. */
export const ImportantFilterFromUrl = ({ boardId }: { boardId: string }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setImportantOnly = useBoardFilters((state) => state.setImportantOnly);
  const important = searchParams.get("important");

  useEffect(() => {
    if (important !== "1") return;

    setImportantOnly(boardId, true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("important");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [boardId, important, pathname, router, searchParams, setImportantOnly]);

  return null;
};
