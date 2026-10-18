# HustFlow

Hướng dẫn chạy HustFlow trên máy local, cấu hình Stripe và triển khai trên Railway.

## 1. Chạy local

### Yêu cầu

- Node.js 20+
- MySQL
- npm
- Tài khoản Clerk, Pusher, UploadThing, Unsplash, OpenAI và Sentry
- Stripe CLI nếu cần kiểm thử thanh toán

### Cài đặt

```bash
cd bkflow
npm install
```

Tạo file `bkflow/.env`:

```env
# Database
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"

# URL ứng dụng
NEXT_PUBLIC_APP_URL="http://localhost:5173"

# Origin được phép gọi API (bắt buộc khi NODE_ENV=production, phân tách bằng dấu phẩy)
APP_ORIGINS="http://localhost:5173"

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/select-org"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/select-org"

# Pusher
PUSHER_APP_ID=""
PUSHER_KEY=""
PUSHER_SECRET=""
PUSHER_CLUSTER=""
NEXT_PUBLIC_PUSHER_KEY=""
NEXT_PUBLIC_PUSHER_CLUSTER=""

# UploadThing
UPLOADTHING_TOKEN=""

# Unsplash
NEXT_PUBLIC_UNSPLASH_ACCESS_KEY=""

# OpenAI
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"

# Stripe
STRIPE_API_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Sentry
# (SENTRY_DSN cho server, mặc định dùng NEXT_PUBLIC_SENTRY_DSN)
NEXT_PUBLIC_SENTRY_DSN=""
SENTRY_ENVIRONMENT="development"
```

Khởi tạo cấu trúc database:

```bash
npx prisma generate
npx prisma db push
```

Chạy ứng dụng (API Hono ở `:4000` + web Vite ở `:5173`, Vite proxy `/api` sang API):

```bash
npm run dev
```

Truy cập [http://localhost:5173](http://localhost:5173).

Build và chạy production (một process Node phục vụ cả API lẫn SPA trên `PORT`, mặc định `4000`):

```bash
npm run build   # gen:actions + build web vào web/dist + tsc
npm start
```

Cấu trúc thư mục chính trong `bkflow/`:

- `server/`: API Hono (`routes/`, `views/`, `actions.ts`, `spa.ts` phục vụ `web/dist`).
- `web/`: SPA React + Vite (`main.tsx`, `router.tsx`, `routes/`, `shims/`).
- `app/**/_components|_hooks|_lib|_types`: component và logic của từng màn hình, SPA import trực tiếp.
- `actions/`, `components/`, `hooks/`, `lib/`, `prisma/`: dùng chung.

Ứng dụng không còn dùng Next.js. Khi chạy production, thêm origin production vào `APP_ORIGINS` và vào danh sách allowed origins trong Clerk Dashboard.

Nếu cần xem dữ liệu:

```bash
npx prisma studio
```

## 2. Kết nối Stripe

Ứng dụng tự tạo Stripe Checkout cho gói `HustFlow Pro` với giá 20 USD/tháng, vì vậy không cần tạo hoặc cấu hình `STRIPE_PRICE_ID`.

### Chạy webhook ở local

Đăng nhập Stripe CLI:

```bash
stripe login
```

Chạy ứng dụng ở terminal thứ nhất:

```bash
cd bkflow
npm run dev
```

Chuyển webhook về local ở terminal thứ hai:

```bash
stripe listen \
  --events checkout.session.completed,invoice.payment_succeeded \
  --forward-to localhost:4000/api/webhook
```

Stripe CLI sẽ trả về một signing secret dạng `whsec_...`. Gán giá trị đó cho:

```env
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Sau khi sửa `.env`, khởi động lại `npm run dev`. Dùng `sk_test_...` cho `STRIPE_API_KEY` khi kiểm thử local.

### Webhook khi deploy

Trong Stripe Dashboard, tạo webhook endpoint:

```text
https://TEN-MIEN-CUA-BAN/api/webhook
```

Chọn hai event:

- `checkout.session.completed`
- `invoice.payment_succeeded`

Sao chép signing secret của endpoint vào biến `STRIPE_WEBHOOK_SECRET` trên Railway. Secret webhook local và secret webhook production là hai giá trị khác nhau.

Nếu sử dụng chức năng quản lý hoặc hủy gói, bật và cấu hình Customer Portal trong Stripe Dashboard.

## 3. Deploy trên Railway

### Tạo service

1. Đẩy repository lên GitHub.
2. Tạo project mới trên Railway và chọn **Deploy from GitHub Repo**.
3. Trong service ứng dụng, đặt **Root Directory**:

```text
/bkflow
```

4. Thêm một service MySQL vào cùng Railway project.
5. Trong Variables của service ứng dụng, tạo:

```env
DATABASE_URL=${{MySQL.MYSQL_URL}}
```

Nếu service database không có tên `MySQL`, thay `MySQL` bằng đúng tên service trên Railway.

### Cấu hình deploy

Trong phần Settings của service ứng dụng:

```text
Build Command: npm run build
Pre-deploy Command: npx prisma db push
Start Command: npm start
```

Dự án hiện dùng `prisma db push` vì repository chưa có thư mục migration.

Thêm toàn bộ biến môi trường đã liệt kê ở phần chạy local vào Railway Variables. Riêng:

```env
APP_ORIGINS="https://TEN-MIEN-CUA-BAN"
NEXT_PUBLIC_APP_URL="https://TEN-MIEN-CUA-BAN"
STRIPE_API_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Có thể tiếp tục dùng Stripe test mode (`sk_test_...`) nếu đây chỉ là bản demo.

Preset Next.js của Vercel không còn áp dụng; có thể deploy lên bất kỳ host Node nào (Railway, Render, Fly, VPS/Docker) với `npm run build` và `npm start`.

### Hoàn tất

1. Vào **Settings → Networking → Generate Domain**.
2. Cập nhật `NEXT_PUBLIC_APP_URL` bằng domain vừa tạo.
3. Thêm domain production vào allowed origins/redirect URL trong Clerk Dashboard (và cập nhật `APP_ORIGINS`).
4. Tạo Stripe webhook production trỏ tới `/api/webhook`.
5. Redeploy service.

Mỗi lần thay đổi Prisma schema, commit schema mới rồi redeploy để Railway chạy lại `npx prisma db push`.

---

## 4. Hướng dẫn sử dụng Trợ lý AI (HustFlow Assistant) theo từng Use Case (UC)

Trợ lý **HustFlow Assistant** là AI Agent hỗ trợ sinh viên quản lý tiến độ, học tập, hạn chót và điều phối đồ án thông minh, được xây dựng trên nền tảng **Vercel AI SDK v7** (`ToolLoopAgent`) kết hợp Google Gemini / OpenAI. 

AI Agent hoạt động theo cơ chế **Function Calling (Tool Calling đa bước)**, tự động đọc ngữ cảnh bảng làm việc thực tế, kiểm tra phân quyền (RBAC), kiểm soát ranh giới học thuật (Academic Guardrails) và đồng bộ thời gian thực (Pusher Realtime).

### 🛠️ Danh mục công cụ (Agent Tools Registry)

| STT | Tên Công cụ (Tool) | Chức năng chính |
| :---: | :--- | :--- |
| 1 | `getDeadlines` | Tra cứu deadline theo mốc thời gian (`today`, `tomorrow`, `this_week`, `overdue`, `mine`...) |
| 2 | `getBoardProgress` | Thống kê tổng quan tỷ lệ hoàn thành, số lượng thẻ theo cột và tiến độ chung |
| 3 | `findCards` | Tìm kiếm thẻ công việc theo từ khóa, lọc theo môn học, người phụ trách hoặc trạng thái |
| 4 | `getCardDetails` | Xem chi tiết nội dung mô tả, checklist, nhãn và thành viên của một thẻ |
| 5 | `createDeadlineCard` | Tạo nhanh 1 thẻ công việc/deadline với ngày giờ, người phụ trách, môn học |
| 6 | `updateCardDeadline` | Cập nhật hạn chót, ngày bắt đầu hoặc đổi trạng thái hoàn thành thẻ |
| 7 | `createRecurringSchedule`| Tạo chuỗi công việc định kỳ lặp lại hàng ngày / hàng tuần / các thứ cố định |
| 8 | `batchCreateCards` | Phân rã và tạo hàng loạt thẻ công việc cho đồ án / bài tập lớn theo tuần |
| 9 | `createCardChecklist` | Tạo danh sách công việc con (checklist) chi tiết bên trong thẻ |
| 10 | `moveCard` | Di chuyển thẻ giữa các danh sách Kanban (ví dụ: chuyển sang "Đang làm") |
| 11 | `updateCardDetails` | Cập nhật tiêu đề, mô tả chi tiết, gán môn học cho thẻ |
| 12 | `archiveCard` | Lưu trữ hoặc xóa một thẻ công việc khỏi bảng |
| 13 | **`createCardDependency`** | **Thiết lập quan hệ phụ thuộc giữa 2 thẻ (Thẻ A làm trước thẻ B; kiểm tra chống chu trình lặp)** |
| 14 | **`deleteCardDependency`** | **Gỡ bỏ liên kết phụ thuộc giữa 2 thẻ công việc trên bảng** |

---

### 💬 Danh sách Prompt theo từng Use Case (UC)

#### 📌 UC-AI 01: Tra cứu công việc, hạn chót & tiến độ cá nhân
* **Mục tiêu:** Sinh viên kiểm tra nhanh các công việc trong ngày, tuần hoặc các thẻ bị quá hạn.
* **Công cụ kích hoạt:** `getDeadlines`, `getBoardProgress`.
* **Prompt mẫu:**
  ```text
  - "Hôm nay tôi cần làm những việc gì trên bảng này?"
  - "Liệt kê các deadline trong tuần này của tôi, việc nào sắp quá hạn?"
  - "Kiểm tra xem tôi có công việc nào bị trễ hạn (overdue) không?"
  - "Báo cáo tiến độ chung của bảng hiện tại: bao nhiêu việc đã xong, bao nhiêu việc còn tồn đọng?"
  - "Tôi đã hoàn thành được bao nhiêu phần trăm công việc của đồ án này rồi?"
  ```

---

#### 📌 UC-AI 02: Tạo nhanh Thẻ / Deadline bằng ngôn ngữ tự nhiên
* **Mục tiêu:** Nhập văn bản tự nhiên, AI tự động trích xuất thông tin (tên việc, ngày giờ, người phụ trách, môn học) và tạo thẻ vào cột phù hợp.
* **Công cụ kích hoạt:** `createDeadlineCard`.
* **Prompt mẫu:**
  ```text
  - "Tạo deadline nộp Báo cáo thí nghiệm Vi xử lý vào thứ Sáu tuần này lúc 23:59"
  - "Thêm việc Chuẩn bị slide thuyết trình môn IT3040 hạn chót 17:00 ngày mai, giao cho tôi"
  - "Tạo thẻ Họp nhóm thống nhất kiến trúc CSDL vào 20:00 tối nay"
  - "Thêm task Nộp bài tập tuần 5 môn Giải tích 1 trước 12:00 trưa Chủ Nhật"
  ```

---

#### 📌 UC-AI 03: Thiết lập & Quản lý quan hệ phụ thuộc công việc (Task Dependencies)
* **Mục tiêu:** Thiết lập quan hệ thẻ tiền đề (Blocker) và thẻ kế nhiệm (Blocked). Agent tự tìm thẻ theo tên, kiểm tra chu trình (Cycle Check bằng BFS) để chống vòng lặp, đồng bộ tức thời lên Kanban, Timeline và **Sơ đồ phụ thuộc (Dependency Graph)**.
* **Công cụ kích hoạt:** `createCardDependency`, `deleteCardDependency`.
* **Prompt mẫu:**
  ```text
  - "Thẻ 'Thiết kế CSDL' phải hoàn thành trước thẻ 'Viết API backend', hãy nối phụ thuộc giúp tôi"
  - "Đặt thẻ 'Khảo sát yêu cầu' làm tiền đề cho thẻ 'Vẽ sơ đồ Use Case'"
  - "Thẻ 'Code Frontend' bị chặn bởi thẻ 'Viết API backend', hãy liên kết chúng lại"
  - "Thiết lập phụ thuộc: phải làm xong 'Viết báo cáo' mới được làm 'Đóng quyển đồ án'"
  - "Gỡ bỏ liên kết phụ thuộc giữa thẻ 'Thiết kế CSDL' và thẻ 'Viết API backend'"
  ```

---

#### 📌 UC-AI 04: Lập kế hoạch Đồ án / Bài tập lớn nhiều bước (WBS)
* **Mục tiêu:** Khi cần lên kế hoạch đề tài lớn, AI phân tích logic, chia thành các giai đoạn tuần tự và tạo hàng loạt thẻ tương ứng với các mốc deadline.
* **Công cụ kích hoạt:** `batchCreateCards`, `createCardDependency`.
* **Prompt mẫu:**
  ```text
  - "Lập kế hoạch làm Đồ án tốt nghiệp trong 4 tuần tới gồm các giai đoạn từ khảo sát đến bảo vệ"
  - "Chia giúp tôi các mốc công việc làm Bài tập lớn môn Kiến trúc phần mềm trong 2 tuần"
  - "Tạo danh sách các công việc cần làm để chuẩn bị bảo vệ đồ án cuối kỳ, chia theo từng tuần"
  - "Lên kế hoạch ôn thi cuối kỳ cho 3 môn Toán rời rạc, Cấu trúc dữ liệu và Mạng máy tính trong 10 ngày tới"
  ```

---

#### 📌 UC-AI 05: Lên lịch định kỳ & Rèn luyện thói quen học tập (Recurring Schedule)
* **Mục tiêu:** Tạo chuỗi công việc lặp lại đều đặn (mỗi ngày, các ngày trong tuần, thứ 2-4-6) kèm khung giờ cố định trên cả Kanban và Calendar.
* **Công cụ kích hoạt:** `createRecurringSchedule`.
* **Prompt mẫu:**
  ```text
  - "Tạo lịch học ôn thi môn Giải tích 1 vào mỗi sáng lúc 05:00 trong 7 ngày tới"
  - "Lên lịch học tiếng Anh lúc 20:00 vào các ngày thứ 2, thứ 4, thứ 6"
  - "Nhắc tôi review code đồ án vào 21:00 mỗi ngày thường (thứ 2 đến thứ 6)"
  - "Lập lịch tập thể dục mỗi sáng lúc 06:30 trong 1 tuần tới"
  ```

---

#### 📌 UC-AI 06: Tạo danh sách kiểm tra con (Checklist) cho thẻ
* **Mục tiêu:** Bổ sung các bước chi tiết cần làm bên trong một thẻ công việc để dễ dàng theo dõi tiến độ từng phần.
* **Công cụ kích hoạt:** `createCardChecklist`.
* **Prompt mẫu:**
  ```text
  - "Thêm checklist các bước cần làm vào thẻ 'Báo cáo thí nghiệm Vi xử lý': Đo dạng sóng, Chụp ảnh oscilloscope, Tính sai số, Nhận xét kết quả"
  - "Gợi ý và tạo checklist kiểm thử cho thẻ 'Viết API đăng nhập'"
  - "Tạo checklist các mục cần chuẩn bị cho thẻ 'Bảo vệ đồ án': Chuẩn bị slide, In 3 bản báo cáo, Chuẩn bị video demo, Kiểm tra máy chiếu"
  ```

---

#### 📌 UC-AI 07: Điều phối luồng công việc & Cập nhật trạng thái thẻ
* **Mục tiêu:** Di chuyển thẻ giữa các cột trạng thái Kanban, gia hạn thời gian, cập nhật mô tả hoặc lưu trữ thẻ hoàn thành.
* **Công cụ kích hoạt:** `moveCard`, `updateCardDeadline`, `updateCardDetails`, `archiveCard`.
* **Prompt mẫu:**
  ```text
  - "Chuyển thẻ 'Thiết kế CSDL' sang cột Đang làm"
  - "Đánh dấu thẻ 'Khảo sát yêu cầu' đã hoàn thành"
  - "Dời hạn chót của thẻ 'Nộp báo cáo giữa kỳ' sang 23:59 Chủ Nhật tuần này"
  - "Đổi tên thẻ 'Fix bug login' thành 'Sửa lỗi xác thực OTP và thêm thông báo lỗi'"
  - "Lưu trữ thẻ 'Họp nhóm tuần 1'"
  ```

---

#### 📌 UC-AI 08: Ranh giới học thuật (Academic Guardrails) & Tư vấn ưu tiên
* **Mục tiêu:** AI kiên quyết từ chối giải hộ bài tập hoặc viết code hộ nhằm bảo đảm liêm chính học thuật, đồng thời chuyển hướng sang hỗ trợ quản lý tiến độ và sắp xếp thứ tự ưu tiên học tập.
* **Ranh giới:** Tuyệt đối không giải bài tập, không viết code thay sinh viên.
* **Prompt thử thách & Phản ứng của Agent:**
  * **Người dùng:** *"Giải hộ tôi bài tập tích phân này với"* hoặc *"Code hộ tôi thuật toán Dijkstra bằng C++"*
  * **HustFlow Assistant:** *Từ chối lịch sự trong 1 câu (theo nguyên tắc Academic Guardrails), sau đó đề xuất tạo deadline nộp bài tập và checklist các bước tự nghiên cứu/ôn tập tài liệu.*
* **Prompt tư vấn ưu tiên học tập:**
  ```text
  - "Tôi đang có quá nhiều bài tập và deadline dồn dập tuần này, hãy tư vấn giúp tôi thứ tự ưu tiên việc nào nên làm trước?"
  - "Gợi ý cách phân bổ thời gian học tập trong tuần này để không bị trễ hạn đồ án"
  ```
