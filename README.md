<h1 align="center">UniFlow</h1>

<p align="center">A project for FE-ITSS Practice in Japanese 2 Course</p>

<p align="center">
  <img src="bkflow/public/logo.svg" width="120" alt="UniFlow logo" />
</p>

<p align="center">
  <img src="https://skillicons.dev/icons?i=react,vite,ts,tailwind,nodejs,prisma,postgres,supabase" alt="React, Vite, TypeScript, Tailwind, Node.js, Prisma, PostgreSQL, Supabase" />
</p>



Ứng dụng quản lý deadline và học tập cá nhân kiểu Trello: bảng theo môn/học kỳ, thẻ công việc, ghi chú, bảng nhóm.

- **AI tự động hóa:** AI Agent tạo thẻ, checklist, lịch định kỳ và phụ thuộc giữa các thẻ từ câu lệnh tự nhiên; nhập việc từ ảnh chụp.
- **Nhắc hạn:** thông báo đẩy (Web Push) trước hạn, worker chạy nền nên vẫn nhắc khi đóng tab.
- **Extension thêm nhanh task:** UniFlow Capture cho phép bôi đen tin nhắn trên Slack, Teams, Messenger, Zalo rồi thêm thành task ngay; AI điền sẵn tiêu đề, hạn và môn.

## Chạy local

**Yêu cầu:** Node.js 22+, PostgreSQL (hoặc Supabase), npm.

```bash
cd bkflow
npm install
cp .env.example .env    # điền các biến trong file
npx prisma db push      # dùng DIRECT_URL (port 5432)
npm run dev             # API :4000 + web :5173
```

Mở [http://localhost:5173](http://localhost:5173).

## Hướng dẫn sử dụng

Cách dùng Trợ lý AI và prompt mẫu: [AGENT_GUIDE.md](AGENT_GUIDE.md).

Các biến bắt buộc tối thiểu: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Các dịch vụ còn lại (Pusher, UploadThing, Unsplash, AI, Sentry, Web Push) xem trong `.env.example`.

## Scripts

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` | Chạy API và web ở chế độ phát triển |
| `npm run build` | Build web và kiểm tra TypeScript |
| `npm start` | Chạy production: một process phục vụ cả API lẫn SPA |
| `npm test` | Chạy unit test |
| `npm run worker:reminders` | Worker nhắc hạn (chạy riêng, 1 replica) |
| `npm run db:rls` | Bật Row Level Security cho bảng public |

## Extension

Tiện ích **UniFlow Capture** (Edge/Chrome) để thêm việc từ tin nhắn Slack, Teams, Messenger, Zalo. Xem [extensions/uniflow-capture/README.md](extensions/uniflow-capture/README.md).
