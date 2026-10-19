# UniFlow Capture (Edge / Chrome, MV3)

Bôi đen tin nhắn trên Slack/Teams **web** → nút "Thêm vào UniFlow" → cửa sổ UniFlow nhỏ (`/capture`)
điền sẵn câu, AI đọc hạn/lịch theo **giờ gửi của tin nhắn** → sửa nếu cần → Thêm.

## Cài (unpacked, không cần store)

1. Edge: mở `edge://extensions`, bật **Developer mode**.
2. **Load unpacked** → chọn thư mục `extensions/uniflow-capture`.
3. Trang cài đặt tự mở (hoặc chuột phải icon → Extension options):
   - Địa chỉ UniFlow mặc định là bản deploy `https://uniflow-production-ba94.up.railway.app` (quyền được cấp lúc cài).
     Chỉ đổi sang `http://localhost:5173` khi chạy thử `npm run dev`.
   - Tích Slack và/hoặc Teams.
4. Tải lại tab Slack/Teams đang mở.

Sửa code extension xong: bấm **Reload** ở `edge://extensions`, rồi tải lại tab.

Phát hành sau này: Edge Add-ons đăng ký miễn phí; Chrome Web Store mất 5$ một lần.

## Quyền và dữ liệu

- Chỉ chạy trên host bạn tích (`optional_host_permissions`), không xin `<all_urls>`, history, cookies hay tabs.
  Quyền cố định duy nhất là domain UniFlow deploy (để chuyển nháp vào trang `/capture`).
- Trước khi bấm nút: không gửi gì, không lưu gì. Sau khi bấm: gửi đoạn bôi đen (≤ 4000 ký tự), URL trang
  (bỏ query/fragment), tiêu đề trang, và giờ gửi của tin chứa đoạn đó (nếu đọc được).
- Bỏ qua chọn trong ô nhập/ô soạn tin (input, textarea, contenteditable).
- Nháp nằm trong `chrome.storage.session` tối đa **15 phút**, mất khi đóng trình duyệt; xóa khi đã thêm hoặc bấm Hủy.
- Extension không giữ token: đăng nhập và lưu task chạy trong trang UniFlow như bình thường.
  URL popup chỉ chứa mã yêu cầu ngẫu nhiên, không chứa nội dung.
- Đóng popup lỡ tay: bấm icon extension để mở lại nháp gần nhất (trong 15 phút).

## Giờ gửi tin

`selection.js` đi từ đoạn chọn lên các phần tử cha và lấy timestamp đầu tiên tìm thấy
(`time[datetime]` của Teams, `[data-ts]` của Slack). Gặp nhiều timestamp cùng cấp thì bỏ (không đoán);
khi đó composer nhắc kiểm tra lại "hôm nay/mai". Giờ gửi luôn hiện trong phần "Nguồn" để bạn đối chiếu.
Cách đọc này **chưa được kiểm trên Slack/Teams thật**; DOM của họ đổi thì cần sửa selector.

## Kiểm tra

```bash
node --test extensions/uniflow-capture/protocol.test.mjs          # từ repo root
cd bkflow && npx tsx --import ./server/register-aliases.mjs --test web/lib/capture-bridge.test.ts
```

Gỡ: bỏ tích host trong cài đặt (tab đang mở cần tải lại), hoặc Remove ở `edge://extensions`.
