"use client";

import { useCallback, useEffect, useState } from "react";
import { tr } from "@/lib/i18n";

import {
  disableDesktopReminders,
  enableDesktopReminders,
  getDesktopReminderState,
  type DesktopReminderState,
} from "@/web/lib/desktop-notifications";

const MESSAGES: Record<DesktopReminderState, string> = {
  enabled: tr("reminder.enabledDesc"),
  disabled: tr("reminder.offDesc"),
  denied: tr("reminder.deniedDesc"),
  unsupported: tr("reminder.unsupportedDesc"),
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
      <p>{failed ? tr("reminder.connectError") : MESSAGES[state]}</p>
      {(state === "enabled" || state === "disabled") && (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? tr("reminder.processing") : state === "enabled" ? tr("reminder.disable") : tr("reminder.enable")}
        </button>
      )}
    </div>
  );
};
