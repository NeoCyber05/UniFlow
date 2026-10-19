import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { CaptureComposer } from "@/components/capture/capture-composer";
import { Button } from "@/components/ui/button";
import { normalizeCaptureSource, type CaptureSource } from "@/lib/capture/source";
import { fetcher } from "@/lib/fetcher";
import type { MyTasksContext } from "@/lib/my-tasks/types";

import { signOut, useAuth, useUser } from "../lib/auth";
import { notifyCapture, readCaptureRequestId, requestCaptureSource } from "../lib/capture-bridge";
import { useTitle } from "../lib/use-title";
import { AuthForm } from "./auth-pages";

type Load =
  | { status: "loading" }
  | { status: "ready"; source: CaptureSource }
  | { status: "error"; message: string };

const UNAVAILABLE: Record<string, string> = {
  missing: "Đoạn đã chọn đã hết hạn (15 phút) hoặc đã được thêm. Hãy bôi đen lại tin nhắn.",
  "no-extension": "Không kết nối được extension UniFlow Capture. Kiểm tra extension đang bật và địa chỉ UniFlow trong phần cài đặt của extension.",
};
const UNAVAILABLE_DEFAULT = "Không lấy được đoạn đã chọn. Hãy bôi đen lại tin nhắn.";

/** Small window opened by the extension: shows the selected text in the shared composer. */
export default function CaptureRoute() {
  useTitle("Thêm vào UniFlow");
  const [requestId] = useState(() => readCaptureRequestId(window.location.hash));
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();
  const [load, setLoad] = useState<Load>(() =>
    requestId ? { status: "loading" } : { status: "error", message: "Thiếu mã yêu cầu. Hãy bôi đen tin nhắn rồi bấm “Thêm vào UniFlow”." },
  );
  // Account that the user confirmed should receive this snippet; a different login must confirm again.
  const [boundUserId, setBoundUserId] = useState<string | null>(null);
  const [listId, setListId] = useState("");
  const [saved, setSaved] = useState(false);
  const confirmed = Boolean(userId) && boundUserId === userId;

  useEffect(() => {
    if (!requestId) return;
    let alive = true;
    void requestCaptureSource(requestId).then((result) => {
      if (!alive) return;
      if (!result.ok) return setLoad({ status: "error", message: UNAVAILABLE[result.reason] ?? UNAVAILABLE_DEFAULT });
      // Data from another context: validate before use.
      try {
        setLoad({ status: "ready", source: normalizeCaptureSource(result.source) });
      } catch {
        setLoad({ status: "error", message: UNAVAILABLE_DEFAULT });
      }
    });
    return () => {
      alive = false;
    };
  }, [requestId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "Escape" || event.defaultPrevented || target?.closest("input, textarea, select")) return;
      window.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: context, isLoading: contextLoading } = useQuery<MyTasksContext>({
    queryKey: ["capture-context", userId],
    queryFn: () => fetcher("/api/my-tasks/context"),
    enabled: confirmed,
  });

  const cancel = () => {
    if (requestId) notifyCapture(requestId, "CAPTURE_CANCEL");
    window.close();
  };

  const onCreated = () => {
    if (requestId) notifyCapture(requestId, "CAPTURE_SAVED");
    setSaved(true);
    setTimeout(() => window.close(), 1_500);
  };

  const body = () => {
    if (!isLoaded || load.status === "loading") return <p className="text-muted-foreground">Đang lấy đoạn đã chọn…</p>;
    if (load.status === "error") return <p role="alert">{load.message}</p>;
    if (saved) return <p role="status" className="font-medium text-emerald-700">Đã thêm task. Cửa sổ sẽ tự đóng…</p>;

    if (!userId) {
      return (
        <div className="space-y-3">
          <p className="text-muted-foreground">Đăng nhập để thêm task. Đoạn đã chọn được giữ trong 15 phút.</p>
          <AuthForm mode="sign-in" next={`${window.location.pathname}${window.location.hash}`} />
        </div>
      );
    }

    if (!confirmed) {
      return (
        <div className="space-y-3 rounded-lg border p-3">
          {boundUserId && <p role="alert" className="text-amber-700">Tài khoản đăng nhập đã thay đổi.</p>}
          <p>Thêm đoạn này vào tài khoản <strong>{user?.primaryEmailAddress?.emailAddress ?? user?.fullName ?? "hiện tại"}</strong>?</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setBoundUserId(userId)}>Tiếp tục</Button>
            <Button size="sm" variant="outline" onClick={() => void signOut()}>Đổi tài khoản</Button>
          </div>
        </div>
      );
    }

    if (contextLoading) return <p className="text-muted-foreground">Đang tải học kỳ…</p>;
    if (!context?.board) {
      return (
        <p role="alert">
          Chưa có học kỳ hiện tại.{" "}
          <a className="underline" href="/my/today" target="_blank" rel="noreferrer">Mở UniFlow</a> để tạo học kỳ rồi thử lại.
        </p>
      );
    }

    return (
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Cột
          <select value={listId} onChange={(event) => setListId(event.target.value)} className="rounded-md border px-2 py-1 text-xs text-foreground">
            <option value="">Cột đầu tiên</option>
            {context.board.lists.map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}
          </select>
        </label>
        <CaptureComposer
          key={userId}
          boardId={context.board.id}
          listId={listId || undefined}
          courses={context.courses}
          initialSource={load.source}
          onCreated={onCreated}
        />
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-md space-y-4 p-4 text-sm">
      <header className="flex items-center justify-between">
        <h1 className="text-base font-semibold">Thêm vào UniFlow</h1>
        {!saved && <Button size="sm" variant="ghost" onClick={cancel}>Hủy</Button>}
      </header>
      {body()}
      {load.status === "ready" && !saved && (
        <p className="text-[11px] text-muted-foreground">
          Đóng cửa sổ: đoạn chọn được giữ 15 phút, bấm biểu tượng extension để mở lại (chỉnh sửa chưa thêm sẽ mất).
        </p>
      )}
    </main>
  );
}
