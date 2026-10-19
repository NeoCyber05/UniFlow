# UniFlow Capture (Edge / Chrome, MV3)

Bôi đen tin nhắn trên **Slack, Microsoft Teams, Messenger, Facebook, Zalo** (bản web) → nút "Thêm vào UniFlow"
→ cửa sổ UniFlow nhỏ (`/capture`), AI điền sẵn tiêu đề, hạn nộp, môn theo **giờ gửi của tin nhắn** → bấm Thêm task.

## Người dùng cài thế nào

Khi đã lên store: trang Edge Add-ons → **Get** → **Add extension**. Edge hỏi quyền trên các trang chat và trang UniFlow
một lần; sau đó extension tự mở `/capture/welcome`. Không có bước cài đặt nào khác.

## Phát hành lên Edge Add-ons (miễn phí)

1. Tăng `version` trong `manifest.json`.
2. Đóng gói (PowerShell, từ repo root):
   ```powershell
   Compress-Archive -Force -Path extensions/uniflow-capture/manifest.json, extensions/uniflow-capture/*.js, extensions/uniflow-capture/options.html, extensions/uniflow-capture/icons -DestinationPath uniflow-capture.zip
   ```
   Zip không chứa `protocol.test.mjs`, `package.json`, `README.md`.
3. Microsoft Partner Center → Edge → tạo extension mới → tải `uniflow-capture.zip`.
4. Trang giới thiệu: mô tả, ảnh 1280×800, logo store `store/logo-300.png` (gốc vector `store/logo.svg`, cùng logo với app `bkflow/public/logo.svg`), chính sách quyền riêng tư
   `https://uniflow-production-ba94.up.railway.app/privacy`, giải thích quyền: "chỉ đọc đoạn người dùng bôi đen
   trên các trang chat, sau khi bấm nút".
5. Có link store → đặt `NEXT_PUBLIC_CAPTURE_EXTENSION_URL` trên Railway rồi build lại, để tutorial hiện nút "Cài".

Chrome Web Store dùng cùng file zip (phí đăng ký 5$ một lần).

## Cài thử (unpacked, cho dev)

1. `edge://extensions` → bật **Developer mode** → **Load unpacked** → chọn `extensions/uniflow-capture`.
2. Chạy bản dev (`npm run dev`): mở Extension options, chọn `http://localhost:5173` → **Lưu và cấp quyền**.
3. Tải lại tab chat đang mở. Sửa code: bấm **Reload** ở `edge://extensions` rồi tải lại tab.

## Quyền và dữ liệu

- Quyền cố định: các trang chat ở trên và domain UniFlow; `localhost` chỉ khi dev tự cấp. Không xin `<all_urls>`,
  history, cookies hay tabs.
- Trước khi bấm nút: không gửi, không lưu gì. Sau khi bấm: đoạn bôi đen (≤ 4000 ký tự), URL trang (bỏ query/fragment),
  tiêu đề trang, giờ gửi của tin (nếu đọc được).
- Bỏ qua chọn trong ô nhập/ô soạn tin. Nháp nằm trong `chrome.storage.session` tối đa 15 phút.
- Extension không giữ token; URL popup chỉ chứa mã ngẫu nhiên. Đóng popup lỡ tay: bấm icon extension để mở lại.
- `bridge.js` gắn `data-uniflow-capture="<version>"` vào trang UniFlow để app biết đã cài.

## Giờ gửi tin

`selection.js` lấy timestamp của tin chứa đoạn chọn (`time[datetime]` của Teams, `[data-ts]` của Slack), bỏ khi mơ hồ.
Messenger/Facebook/Zalo chưa có cách đọc giờ đã biết: popup không hiện "Gửi lúc" và AI tính theo lúc bôi đen,
nên tin cũ có "hôm nay" cần kiểm tra ngày. Chưa kiểm trên các trang thật; DOM đổi thì cần sửa selector.

## Kiểm tra

```bash
node --test extensions/uniflow-capture/protocol.test.mjs          # từ repo root
cd bkflow && npx tsx --import ./server/register-aliases.mjs --test web/lib/capture-bridge.test.ts
```
