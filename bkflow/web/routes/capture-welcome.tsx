import { Link } from "react-router";
import { MousePointerClick, Sparkles, Highlighter } from "lucide-react";

import { CAPTURE_SITES } from "@/lib/capture/extension";

import { useTitle } from "../lib/use-title";

const STEPS = [
  { icon: Highlighter, title: "Bôi đen tin nhắn", body: `Trên ${CAPTURE_SITES.join(", ")} (bản web), bôi đen tin của thầy cô hoặc nhóm.` },
  { icon: MousePointerClick, title: "Bấm “Thêm vào UniFlow”", body: "Nút hiện ngay cạnh đoạn bôi đen. Một cửa sổ nhỏ của UniFlow mở ra." },
  { icon: Sparkles, title: "AI điền sẵn, bạn bấm Thêm", body: "Tiêu đề, hạn nộp, danh mục được điền từ tin nhắn. Kiểm tra lại rồi bấm Thêm task." },
];

/** Opened by the extension right after it is installed. */
export default function CaptureWelcomeRoute() {
  useTitle("UniFlow Capture đã sẵn sàng");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="" className="h-10 w-10" />
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">UniFlow Capture đã sẵn sàng</h1>
            <p className="text-sm text-neutral-500">Biến tin nhắn thành task chỉ với một lần bôi đen.</p>
          </div>
        </div>

        <ol className="space-y-4">
          {STEPS.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-neutral-900">{index + 1}. {title}</p>
                <p className="text-sm text-neutral-500">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          Tab chat đang mở cần tải lại một lần để nút xuất hiện. Extension chỉ đọc đoạn bạn bôi đen, sau khi bạn bấm nút.{" "}
          <Link to="/privacy" className="underline">Chính sách quyền riêng tư</Link>
        </p>

        <Link
          to="/my/today"
          className="flex h-10 w-full items-center justify-center rounded-lg bg-violet-600 text-sm font-medium text-white hover:bg-violet-700"
        >
          Mở UniFlow
        </Link>
      </div>
    </main>
  );
}
