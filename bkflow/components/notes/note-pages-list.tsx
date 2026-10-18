"use client";

import Link from "@/web/shims/next-link";
import { useRouter } from "@/web/shims/next-navigation";
import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const NotePagesList = () => {
  const router = useRouter();
  const { userId } = useAuth();
  const [creating, setCreating] = useState(false);
  const { data, isPending, isError, refetch } = useQuery<{ id: string; title: string; updatedAt: string }[]>({
    queryKey: ["note-pages", userId], enabled: Boolean(userId),
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/pages", { signal, cache: "no-store" });
      if (!response.ok) throw new Error("Cannot load pages");
      return response.json();
    },
  });
  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const response = await fetch("/api/pages", { method: "POST" });
      if (!response.ok) throw new Error("Chưa tạo được ghi chú.");
      const page = await response.json() as { id: string };
      router.push(`/pages/${encodeURIComponent(page.id)}`);
    } catch { toast.error("Chưa tạo được ghi chú. Hãy thử lại."); }
    finally { setCreating(false); }
  };
  return <div className="mx-auto max-w-5xl">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold">Trang của tôi</h1><p className="mt-2 text-sm text-muted-foreground">Ghi chú riêng trong không gian cá nhân. Mỗi trang, một cách viết.</p></div><Button disabled={creating || !userId} onClick={() => void create()}>{creating ? "Đang tạo…" : "Tạo trang"}</Button></header>
    {!userId ? <p role="status">Đăng nhập để mở ghi chú.</p> : isPending ? <p role="status">Đang tải trang…</p> : isError ? <div role="alert">Chưa tải được ghi chú. <Button variant="link" onClick={() => void refetch()}>Thử lại</Button></div> : data?.length ? <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.map(page => <Link key={page.id} href={`/pages/${encodeURIComponent(page.id)}`} className="rounded-xl border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"><h2 className="truncate font-medium">{page.title}</h2><p className="mt-3 text-xs text-muted-foreground">Sửa {new Date(page.updatedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p></Link>)}</div>
      {data.length === 100 && <p className="mt-4 text-sm text-muted-foreground">Hiển thị 100 trang mới sửa gần nhất. Dùng Tìm nhanh để mở các trang cũ hơn.</p>}
    </> : <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Chưa có ghi chú. Tạo trang đầu tiên để bắt đầu.</div>}
  </div>;
};
