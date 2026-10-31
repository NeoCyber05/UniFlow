import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { tr } from "@/lib/i18n";

/** Đích của click thông báo nhắc: máy chủ kiểm quyền rồi mới cho biết board/task, không tin URL từ push. */
export default function ReminderDeliveryRoute() {
  const { deliveryId } = useParams();
  const navigate = useNavigate();
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/push/deliveries/${encodeURIComponent(deliveryId ?? "")}`)
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) return setUnavailable(true);
        const { boardId, cardId } = (await res.json()) as { boardId: string; cardId: string };
        navigate(`/board/${boardId}?task=${cardId}`, { replace: true });
      })
      .catch(() => alive && setUnavailable(true));
    return () => {
      alive = false;
    };
  }, [deliveryId, navigate]);

  return (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      {unavailable ? tr("reminderPage.unavailable") : tr("reminderPage.opening")}
    </div>
  );
}
