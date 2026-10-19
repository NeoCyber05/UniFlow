import { CAPTURE_SITES } from "@/lib/capture/extension";

import { useTitle } from "../lib/use-title";

/** Privacy policy; required by the extension store listing. */
export default function PrivacyRoute() {
  useTitle("Chính sách quyền riêng tư");

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-10 text-sm leading-6 text-neutral-700">
      <h1 className="text-2xl font-semibold text-neutral-900">Chính sách quyền riêng tư</h1>
      <p>Áp dụng cho UniFlow và extension trình duyệt UniFlow Capture. Cập nhật ngày 20/10/2026.</p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-neutral-900">UniFlow lưu gì</h2>
        <p>Tài khoản (email, tên), và nội dung bạn tạo: học kỳ, môn, task, ghi chú, lịch, nhắc hạn. Dữ liệu chỉ dùng để chạy ứng dụng cho chính bạn, không bán và không dùng cho quảng cáo.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-neutral-900">Extension UniFlow Capture</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Chỉ chạy trên {CAPTURE_SITES.join(", ")} (bản web) và trên trang UniFlow.</li>
          <li>Trước khi bạn bấm “Thêm vào UniFlow”: không đọc, không gửi, không lưu gì.</li>
          <li>Sau khi bấm: gửi đoạn bạn bôi đen (tối đa 4000 ký tự), địa chỉ trang (đã bỏ phần query), tiêu đề trang và giờ gửi của tin nhắn đó tới cửa sổ UniFlow của bạn.</li>
          <li>Không đọc cả cuộc hội thoại, cookie, mật khẩu hay token đăng nhập của các trang chat; bỏ qua ô nhập và ô soạn tin.</li>
          <li>Nháp được giữ trong bộ nhớ phiên của trình duyệt tối đa 15 phút rồi xóa; không có máy chủ riêng của extension.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-neutral-900">AI</h2>
        <p>Để điền sẵn tiêu đề và hạn nộp, đoạn tin nhắn được gửi tới dịch vụ AI (Google Gemini) để phân tích. Task chỉ được lưu khi bạn bấm Thêm.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-neutral-900">Xóa dữ liệu</h2>
        <p>Bạn có thể xóa task trong UniFlow bất cứ lúc nào. Gỡ extension sẽ xóa toàn bộ dữ liệu tạm của nó trong trình duyệt.</p>
      </section>
    </main>
  );
}
