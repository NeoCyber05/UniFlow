# HUSTFLOW - ACADEMIC EDITION SPECIFICATION & PROGRESS TRACKER
> **Tài liệu đặc tả kỹ thuật và theo dõi tiến độ phát triển các tính năng hỗ trợ sinh viên**

---

## 📊 Bảng Theo Dõi Tiến Độ Tổng Quan (Progress Overview)

| Mô-đun | Trạng thái | Ưu tiên | Người phụ trách | Ngày hoàn thành |
| :--- | :---: | :---: | :---: | :---: |
| **Mô-đun 1: Học kỳ & Môn học (Academic Hierarchy)** | 🔵 Đang làm (chờ migrate DB) | P1 (Cao) | | |
| **Mô-đun 2: Syllabus Importer & Vector DB (RAG)** | 🟡 Chưa bắt đầu | P2 (Trung bình) | | |
| **Mô-đun 3: Rich Text Editor & Slash Command (`/`)** | 🟡 Chưa bắt đầu | P1 (Cao) | | |
| **Mô-đun 4: Trợ lý AI Quản lý & Nhắc Deadline (AI Floating Copilot)** | 🔵 Đang làm (chờ migrate DB + GEMINI_API_KEY) | P2 (Trung bình) | | |
| **Mô-đun 5: Mẫu Bảng & Mẫu Thẻ (Templates)** | 🟡 Chưa bắt đầu | P1 (Cao) | | |
| **Mô-đun 6: Thẻ lặp lại định kỳ (Recurring Tasks)** | 🟡 Chưa bắt đầu | P2 (Trung bình) | | |
| **Mô-đun 7: Nhắc hạn qua Bot Telegram / Discord** | 🟡 Chưa bắt đầu | P2 (Trung bình) | | |

*Ghi chú trạng thái: 🔴 Đang lỗi | 🟡 Chưa bắt đầu | 🔵 Đang làm | 🟢 Hoàn thành*

---

## MÔ-ĐUN 1: Cơ Cấu Không Gian "Học Kỳ & Môn Học" (Academic Workspace Hierarchy)

### 🎯 Mục tiêu
Chuyển đổi cấu trúc phẳng `Organization -> Board` thành mô hình chuẩn trường học: `Học kỳ (Semester) -> Môn học / Dự án (Course / Project Board)`.

### 🗄️ Thiết kế Dữ liệu (Prisma Schema)
```prisma
model Semester {
  id        String   @id @default(uuid())
  orgId     String   // Liên kết với Organization của UniFlow / Supabase
  title     String   // Ví dụ: "Kỳ 2024.1", "Học kỳ 1 (2024-2025)"
  startDate DateTime
  endDate   DateTime
  isCurrent Boolean  @default(false)
  boards    Board[]  // Các môn học/board thuộc học kỳ này

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orgId])
}

// Bổ sung vào model Board:
// semesterId   String?
// semester     Semester? @relation(fields: [semesterId], references: [id], onDelete: SetNull)
// courseCode   String?   // Mã học phần, vd: "IT3040", "MI1111"
// credits      Int?      // Số tín chỉ: vd 3
// boardType    BoardType @default(COURSE) // COURSE (Môn học), TEAM_PROJECT (Đồ án nhóm)
```

### 📋 Checklist Triển khai
- [x] **Database & Backend**:
  - [x] Cập nhật file `schema.prisma` với model `Semester` và các trường mới của `Board`.
  - [ ] Chạy `npx prisma db push` hoặc tạo migration. *(Chưa chạy được trong môi trường hiện tại do không có kết nối tới Supabase — cần chạy tay: `cd bkflow && npx prisma db push`.)*
  - [x] Viết Server Actions cho Semester:
    - [x] `createSemester` (Tạo học kỳ mới)
    - [x] `updateSemester` (Đổi tên, ngày bắt đầu - kết thúc)
    - [x] `deleteSemester` (Xóa học kỳ, set null trên các board liên quan)
    - [x] `setCurrentSemester` (Đặt làm học kỳ mặc định hiển thị)
  - [x] Cập nhật Server Actions tạo/sửa Board để nhận thêm `semesterId`, `courseCode`, `credits`, `boardType`.
- [x] **Giao diện & UI/UX**:
  - [x] Tạo component `SemesterSwitcher` trên Sidebar hoặc Header của Organization.
  - [x] Modal tạo / quản lý học kỳ (nhập tên, ngày bắt đầu, ngày kết thúc).
  - [x] Trang danh sách Board (`/organization/[id]`):
    - [x] Lọc bảng theo học kỳ đang chọn.
    - [x] Chia 2 tab rõ ràng: **"Môn học cá nhân"** và **"Đồ án nhóm"**.
    - [x] Hiển thị Badge mã học phần (vd: `IT3040`) và số tín chỉ trên thẻ Board.
- [x] **Nghiệm thu (Acceptance Criteria)**:
  - [x] Sinh viên tạo được học kỳ mới và gán các môn học vào học kỳ.
  - [x] Chuyển đổi giữa các học kỳ lọc đúng các Board tương ứng.

---

## MÔ-ĐUN 2: Syllabus & Assignment Importer với Kho Đề Cương (Vector DB / RAG)

### 🎯 Mục tiêu
Sinh viên chỉ cần **chọn hoặc nhập mã môn học** (ví dụ: `IT3040`), hệ thống tự động truy vấn Vector DB chứa kho đề cương chuẩn để trích xuất danh sách bài tập, lab, đồ án của cả kỳ và tự động tạo thành các thẻ có Due Date. Đồng thời hỗ trợ upload file PDF/ảnh nếu có đề bài riêng từ giáo viên.

### 🗄️ Thiết kế Dữ liệu & RAG Pipeline
```
Kho Đề cương PDF (HUST / ĐH) 
  -> Chunking & Embeddings (text-embedding-3-small)
  -> Vector DB (pgvector / Qdrant)
  -> Query bằng mã môn ("IT3040")
  -> LLM trích xuất JSON các đầu việc theo tuần
  -> Preview & 1-click Import tạo Card hàng loạt
```

### 📋 Checklist Triển khai
- [ ] **Vector Database & Chuẩn bị dữ liệu**:
  - [ ] Kích hoạt extension `vector` trên PostgreSQL (hoặc kết nối Vector DB ngoài).
  - [ ] Tạo bảng lưu trữ đề cương `SyllabusDocument` (id, courseCode, title, content, embedding).
  - [ ] Viết script ingest mẫu dữ liệu đề cương của 5-10 môn học phổ biến.
- [ ] **Backend & AI Logic**:
  - [ ] Route Handler / Server Action `searchSyllabusByCode`:
    - [ ] Tìm kiếm tài liệu tương ứng mã môn học.
    - [ ] Gọi OpenAI `gpt-4o-mini` phân tích nội dung đề cương kết hợp với thời gian học kỳ để tính mốc Due Date từng bài.
    - [ ] Trả về JSON: Danh sách bài tập, tuần nộp dự kiến, mô tả ngắn, checklist gợi ý.
  - [ ] Server Action `importAssignmentsToBoard`: Nhận danh sách bài tập đã duyệt từ client và tạo hàng loạt List/Card trên Board.
- [ ] **Giao diện & UI/UX**:
  - [ ] Nút **"Khởi tạo từ Đề cương"** trên thanh công cụ của Board.
  - [ ] Hộp thoại tìm kiếm môn học (Autocomplete theo mã môn, tên môn).
  - [ ] Tab tùy chọn dự phòng: Cho phép tải lên file PDF đề cương riêng nếu môn học chưa có trong kho.
  - [ ] Màn hình xem trước (Preview Modal): Cho phép tick chọn bài tập muốn thêm, chỉnh sửa nhanh hạn chót trước khi xác nhận.
- [ ] **Nghiệm thu (Acceptance Criteria)**:
  - [ ] Nhập `IT3100` -> AI sinh ra danh sách 4 bài Lab + 1 Bài tập lớn đúng tiến độ tuần.
  - [ ] Bấm xác nhận -> Các thẻ xuất hiện đầy đủ trên Board với Due Date tương ứng.

---

## MÔ-ĐUN 3: Trình Soạn Thảo Thẻ Nâng Cao (Rich Text & Slash Command `/`)

### 🎯 Mục tiêu
Thay thế `textarea` Markdown thô bằng trình soạn thảo WYSIWYG trực quan kiểu Notion: gõ `/` để gọi menu chèn heading, checklist, bảng biểu, hộp lưu ý (callout), code highlight. Cho phép paste ảnh trực tiếp từ clipboard (`Ctrl + V`).

### 🛠️ Thư viện đề xuất
* **TipTap** (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`)

### 📋 Checklist Triển khai
- [ ] **Setup thư viện**:
  - [ ] Cài đặt TipTap core và các extensions:
    - [ ] `@tiptap/extension-placeholder`
    - [ ] `@tiptap/extension-task-list` & `@tiptap/extension-task-item`
    - [ ] `@tiptap/extension-code-block-lowlight` (hỗ trợ highlight C, C++, Python, JS...)
    - [ ] `@tiptap/extension-table`
    - [ ] `@tiptap/extension-image`
- [ ] **Xây dựng Slash Command Menu (`/`)**:
  - [ ] Bắt phím `/` mở Floating Suggestion Popover.
  - [ ] Menu hỗ trợ:
    - [ ] Heading 1, 2, 3
    - [ ] Danh sách bullet & Checkbox task list
    - [ ] Khối mã nguồn (Code Block)
    - [ ] Bảng biểu cơ bản (Table)
    - [ ] Hộp Callout lưu ý (Info, Warning, Tip)
- [ ] **Hỗ trợ Paste Ảnh Trực Tiếp (`Ctrl + V`)**:
  - [ ] Bắt sự kiện paste `image/*` từ clipboard trong editor.
  - [ ] Tự động gọi UploadThing tải ảnh lên và chèn URL ảnh trực tiếp vào bài viết.
- [ ] **Tích hợp vào Card Modal**:
  - [ ] Thay thế thành phần `description.tsx` hiện tại.
  - [ ] Lưu nội dung dạng HTML hoặc JSON TipTap.
  - [ ] Tương thích với cơ chế kiểm tra xung đột chỉnh sửa đồng thời (Conflict Check) đang có.
- [ ] **Nghiệm thu (Acceptance Criteria)**:
  - [ ] Gõ `/callout` chèn hộp chú thích thành công.
  - [ ] Chụp màn hình và bấm `Ctrl + V` chèn ảnh ngay lập tức mà không cần bấm nút upload.

---

## MÔ-ĐUN 4: Trợ Lý AI Quản Lý & Nhắc Hẹn Deadline (AI Floating Copilot)

### 🎯 Mục tiêu
Widget tròn nhỏ ở góc màn hình đóng vai trò trợ lý cá nhân: chuyên phục vụ quản lý công việc, nhắc hẹn hạn chót (deadline), hỏi đáp về tiến độ môn học/đồ án và hỗ trợ tạo nhanh deadline/thẻ công việc bằng ngôn ngữ tự nhiên. Tuyệt đối không bao gồm chức năng đọc hiểu đề bài hay giải bài tập hộ sinh viên.

### 🗄️ Thiết kế Dữ liệu
```prisma
model BoardAiChat {
  id        String   @id @default(uuid())
  boardId   String
  userId    String
  role      String   // "user" | "assistant"
  content   String   @db.Text
  parts     Json?    // UIMessage parts (text + tool calls) để khôi phục Action Card
  createdAt DateTime @default(now())

  @@index([boardId, userId])
  @@index([boardId, userId, createdAt])
}
```

### 🧠 Kiến trúc AI Agent
* **Framework**: Vercel AI SDK v7 (`ai`, `@ai-sdk/google`, `@ai-sdk/react`) — `ToolLoopAgent` (agent loop đa bước, tối đa 6 step), tool calling typed bằng Zod, streaming UI message qua `createAgentUIStreamResponse` + `useChat`.
* **Model**: Google Gemini (`GEMINI_MODEL`, mặc định `gemini-flash-latest`), key `GEMINI_API_KEY`.
* **Code**: `lib/ai/copilot/*` (agent, tools, board context, timezone, history), `app/api/ai/chat/route.ts` (GET lịch sử / POST stream / DELETE xóa), `components/ai-copilot/*` (FAB + panel).
* **Bảng `BoardAiChat`**: thêm cột `parts Json?` để khôi phục đầy đủ tool call / Action Card khi tải lại lịch sử.

### 📋 Checklist Triển khai
- [x] **Backend & AI Assistant Engine**:
  - [x] API Route chat streaming (`/api/ai/chat`) tích hợp Gemini qua Vercel AI SDK (thay cho OpenAI `gpt-4o-mini`).
  - [x] Cấu hình System Prompt & Ranh giới (Guardrails):
    - [x] Nạp ngữ cảnh hiện tại của Board: danh sách công việc, hạn chót sắp tới, thành viên được phân công, trạng thái các thẻ (+ lịch 14 ngày theo múi giờ người dùng).
    - [x] Quy định chặt chẽ: AI chỉ tập trung hỗ trợ quản lý công việc, hỏi đáp deadline, nhắc hẹn, sắp xếp thời gian biểu; từ chối mọi yêu cầu đọc hiểu đề bài hay giải bài tập.
  - [x] Hỗ trợ Function Calling (Công cụ quản lý công việc):
    - [x] Tra cứu & thống kê deadline: `getDeadlines` (quá hạn / hôm nay / ngày mai / tuần này / 7 ngày tới…, lọc "của tôi"), `getBoardProgress`, `findCards`.
    - [x] Tạo deadline / thẻ mới: `createDeadlineCard` (tự động tạo thẻ, có thể giao cho bản thân/thành viên, hiển thị Action Card).
    - [x] Cập nhật hoặc gia hạn deadline cho thẻ hiện có trên bảng: `updateCardDeadline` (dùng lại `updateCardService`).
  - [x] Phân quyền: chỉ thành viên bảng được chat; VIEWER không được tạo/sửa thẻ; lịch sử chat lưu riêng theo (board, user).
  - [ ] Chạy `npx prisma db push` để tạo bảng `BoardAiChat`.
- [x] **Giao diện & UI/UX**:
  - [x] Nút bấm nổi ở góc dưới bên phải màn hình (`Floating Action Button`).
  - [x] Cửa sổ Chat Popover (hỗ trợ thu nhỏ/mở rộng, kéo thả vị trí).
  - [x] Khung nhập tin nhắn tinh gọn kèm danh sách câu hỏi gợi ý nhanh.
  - [x] Khung chat hiển thị tin nhắn định dạng Markdown và giao diện thẻ hành động (Action Card) khi tạo deadline thành công.
- [ ] **Nghiệm thu (Acceptance Criteria)**:
  - [ ] Hỏi *"Hôm nay tôi cần làm gì trên bảng này?"* -> AI liệt kê chính xác các thẻ được giao có hạn chót gần nhất.
  - [ ] Chat *"Tạo deadline nộp bài tập lớn vào Chủ Nhật 23:59"* -> AI tự động tạo thẻ kèm hạn chót chính xác trên bảng.
  - [ ] Yêu cầu giải bài tập hoặc nhờ đọc đề bài thi -> AI từ chối lịch sự và hướng dẫn người dùng tập trung vào quản lý tiến độ & deadline.

---

## MÔ-ĐUN 5: Mẫu Bảng & Mẫu Thẻ (Board & Card Templates)

### 🎯 Mục tiêu
Cung cấp sẵn các mẫu chuẩn dành riêng cho sinh viên để khởi tạo môn học hoặc đồ án trong 5 giây mà không cần setup cột/nhãn từ đầu.

### 📋 Danh mục Templates tích hợp:
1. **Mẫu Bảng (Board Templates)**:
   * **Đồ án tốt nghiệp / NCKH**: `Ý tưởng đề tài` ➔ `Nghiên cứu tài liệu` ➔ `Triển khai & Thử nghiệm` ➔ `Viết báo cáo & Đóng quyển` ➔ `Chuẩn bị slide bảo vệ`.
   * **Sprint Scrum (Phát triển phần mềm)**: `Product Backlog` ➔ `Sprint Backlog` ➔ `In Progress` ➔ `Code Review & Test` ➔ `Done`.
   * **Môn học lý thuyết & Bài tập**: `Chưa học` ➔ `Đang học` ➔ `Bài tập cần nộp` ➔ `Đã hoàn thành / Ôn thi`.
   * **Tổ chức sự kiện CLB / Đoàn Hội**: `Lên ý tưởng` ➔ `Hậu cần & Tài chính` ➔ `Truyền thông` ➔ `Ngày diễn ra` ➔ `Tổng kết`.
2. **Mẫu Thẻ (Card Templates)**:
   * **Báo cáo lỗi (Bug Report)**: Khung các bước tái hiện, lỗi thực tế, kết quả mong muốn.
   * **Báo cáo thí nghiệm (Lab Report)**: Khung mục tiêu lab, sơ đồ mạch/code, kết quả đo, đánh giá.
   * **Biên bản họp nhóm (Meeting Notes)**: Khung thời gian họp, thành viên có mặt, nội dung chốt, phân công việc.

### 📋 Checklist Triển khai
- [ ] **Backend & Cấu hình**:
  - [ ] Tạo file `constants/academic-board-templates.ts` chứa dữ liệu các cột và nhãn mẫu.
  - [ ] Tạo file `constants/academic-card-templates.ts` chứa nội dung mô tả và checklist mẫu.
  - [ ] Thêm trường `isTemplate Boolean @default(false)` vào model `Card` để sinh viên có thể tự lưu thẻ làm mẫu riêng.
- [ ] **Giao diện & UI/UX**:
  - [ ] Cập nhật Form tạo bảng (`form-popover.tsx`): Thêm tab "Chọn mẫu học tập" với hình ảnh xem trước các cột.
  - [ ] Cập nhật Form tạo thẻ (`card-form.tsx`): Thêm nút chọn nhanh mẫu thẻ trước khi tạo.
- [ ] **Nghiệm thu (Acceptance Criteria)**:
  - [ ] Chọn mẫu "Đồ án tốt nghiệp" tạo bảng mới -> Bảng tự động có đủ 5 cột chuyên biệt cùng bộ nhãn màu chuẩn.

---

## MÔ-ĐUN 6: Thẻ Lặp Lại Định Kỳ (Recurring Tasks)

### 🎯 Mục tiêu
Tự động tái tạo các công việc lặp lại định kỳ trong kỳ học: "Họp nhóm đồ án vào thứ Hai", "Nộp báo cáo tiến độ tuần", "Làm Quiz trắc nghiệm LMS hàng tuần".

### 🗄️ Thiết kế Dữ liệu
```prisma
enum RECURRING_FREQUENCY {
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
}

// Bổ sung vào model Card:
// isRecurring        Boolean              @default(false)
// recurringFrequency RECURRING_FREQUENCY?
// recurringDaysOfWeek String?             // vd: "1,3,5" (T2, T4, T6)
// nextRunAt          DateTime?
```

### 📋 Checklist Triển khai
- [ ] **Database & Cron Engine**:
  - [ ] Bổ sung các trường recurring vào model `Card` trong `schema.prisma`.
  - [ ] Viết Route Handler `/api/cron/recurring-cards`:
    - [ ] Quét các thẻ có `isRecurring = true` và `nextRunAt <= now()`.
    - [ ] Nhân bản thẻ mới vào cột đầu tiên của Board (giữ nguyên nhãn, assignee, checklist).
    - [ ] Cập nhật ngày `nextRunAt` tiếp theo dựa trên chu kỳ đã chọn.
  - [ ] Cấu hình cron kích hoạt định kỳ (Cron job hoặc Vercel Cron).
- [ ] **Giao diện & UI/UX**:
  - [ ] Thêm mục "Lặp lại công việc" trong Modal chi tiết thẻ (Chọn tần suất: Hàng ngày, Hàng tuần vào thứ X).
  - [ ] Hiển thị biểu tượng lặp lại (icon `RefreshCw` nhỏ) trên mặt thẻ Kanban.
- [ ] **Nghiệm thu (Acceptance Criteria)**:
  - [ ] Cài đặt thẻ "Họp nhóm đồ án" lặp lại vào thứ Hai -> Khi đến hẹn, thẻ mới tự động xuất hiện trên bảng.

---

## MÔ-ĐUN 7: Nhắc Hạn Đa Kênh (Bot Telegram & Discord)

### 🎯 Mục tiêu
Gửi thông báo và cảnh báo deadline trực tiếp vào Telegram / Discord cá nhân hoặc nhóm chat đồ án của sinh viên.

### 🗄️ Thiết kế Dữ liệu
```prisma
model UserNotificationIntegration {
  id             String   @id @default(uuid())
  userId         String   @unique
  telegramChatId String?
  discordWebhook String?
  notifyBeforeHours Int   @default(24) // Nhắc trước 24h và 3h
  isEnabled      Boolean  @default(true)

  createdAt      DateTime @default(now())
}
```

### 📋 Checklist Triển khai
- [ ] **Bot Telegram (Kênh cá nhân)**:
  - [ ] Tạo Bot Telegram qua BotFather lấy `TELEGRAM_BOT_TOKEN`.
  - [ ] Xây dựng Webhook nhận lệnh `/start <auth_token>` để lưu `telegramChatId` của sinh viên.
- [ ] **Discord Webhook (Kênh nhóm đồ án)**:
  - [ ] Bổ sung trường `discordWebhookUrl` vào model `Board`.
  - [ ] Viết hàm gửi tin nhắn định dạng Embed sang Discord khi có sự kiện (tạo task mới, task sắp đến hạn).
- [ ] **Background Dispatcher (Bộ gửi tin nhắc nhở)**:
  - [ ] Cron job quét định kỳ:
    - [ ] 08:00 sáng: Gửi tóm tắt danh sách các việc cần làm trong ngày.
    - [ ] Cảnh báo khẩn cấp: Gửi tin nhắn trước 3 tiếng khi thẻ sắp hết hạn mà chưa xong.
- [ ] **Giao diện & UI/UX**:
  - [ ] Trang Cài đặt cá nhân: Thêm nút "Kết nối Telegram" (quét mã QR hoặc link dẫn tới bot).
  - [ ] Cài đặt Board: Thêm ô dán Discord Webhook URL cho kênh chat của nhóm đồ án.
- [ ] **Nghiệm thu (Acceptance Criteria)**:
  - [ ] Sinh viên liên kết tài khoản Telegram -> Nhận thông báo nhắc nhở kèm nút bấm mở ngay thẻ bài tập.

---

*Tài liệu này được biên soạn để đồng hành cùng quá trình phát triển mã nguồn của HustFlow. Hãy đánh dấu `[x]` vào các checkbox tương ứng khi hoàn thành từng hạng mục.*
