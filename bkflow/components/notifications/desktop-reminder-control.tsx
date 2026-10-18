"use client";

import { useCallback, useEffect, useState } from "react";

import {
  disableDesktopReminders,
  enableDesktopReminders,
  getDesktopReminderState,
  type DesktopReminderState,
} from "@/web/lib/desktop-notifications";

const MESSAGES: Record<DesktopReminderState, string> = {
  enabled: "Máy này đang nhận nhắc hạn, kể cả khi đã đóng tab UniFlow.",
  disabled: "Chưa đăng ký nhận nhắc hạn trên máy này.",
  denied: "Trình duyệt đang chặn thông báo. Mức nhắc vẫn được lưu; bật lại quyền thông báo trong cài đặt trình duyệt để nhận nhắc khi đóng tab.",
  unsupported: "Trình duyệt này không hỗ trợ thông báo nền. Bạn vẫn nhận nhắc khi mở UniFlow.",
};

/** Nút bật/tắt thông báo nền của thiết bị; chỉ xin quyền khi người dùng bấm. */
export const DesktopReminderControl = () => {
  const [state, setState] = useState<DesktopReminderState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(() => {
    getDesktopReminderState().then(setState, () => setState("unsupported"));
  }, []);

  useEffect(refresh, [refresh]);

  const toggle = async () => {
    setBusy(true);
    setFailed(false);
    try {
      if (state === "enabled") {
        await disableDesktopReminders();
      } else {
        const result = await enableDesktopReminders();
        setFailed(result.state === "error");
      }
    } finally {
      setBusy(false);
      refresh();
    }
  };

  if (!state) return null;

  return (
    <div className="space-y-1.5 text-xs text-neutral-500" aria-live="polite">
      <p>{failed ? "Chưa đăng ký: không kết nối được máy chủ nhắc. Hãy thử lại." : MESSAGES[state]}</p>
      {(state === "enabled" || state === "disabled") && (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Đang xử lý..." : state === "enabled" ? "Tắt thông báo trên máy này" : "Bật thông báo trên máy này"}
        </button>
      )}
    </div>
  );
};
