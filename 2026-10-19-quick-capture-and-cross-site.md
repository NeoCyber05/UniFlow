# Quick Capture and Cross-site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Chỉ dùng subagent khi đã có chỉ dẫn phù hợp.

**Goal:** Nhập câu, nói hoặc chọn văn bản trên Teams/Slack để xem/sửa cùng một nháp và chủ động lưu đúng một task, gồm lịch, hạn, nhắc và todo.

**Architecture:** Dùng một composer và một mô hình nháp có revision/provenance; mở rộng action AI và transaction tạo card hiện tại. Extension chỉ đưa đoạn chọn vào cửa sổ UniFlow nhỏ; xác thực và lưu vẫn chạy tại origin UniFlow, không đưa token vào extension. Voice và giao thức extension phải qua khảo sát thực tế trước phần triển khai phụ thuộc.

**Tech Stack:** React 19, React Router, Vite, Hono, Zod, Prisma/PostgreSQL, Supabase Auth, Node test runner/tsx; Manifest V3 và browser speech API nếu khảo sát đạt.

**Spec:** [03 — Quick capture và cross-site](../specs/2026-10-18-deadline-ux/03-quick-capture-and-cross-site.md), đọc cùng [quy ước YC/ĐX/MD/Q](../specs/2026-10-18-deadline-ux/README.md).

## Global Constraints

- Chỉ lập plan trong lần làm này. Khi thực thi: không stage, commit, push; giữ thay đổi đang có của người dùng.
- YC là yêu cầu nguồn; ĐX/MD là phương án để review. Plan không biến Q3/Q6 thành quyết định đã được người dùng duyệt.
- Một task, một Card.id. AI/transcript/selection chỉ tạo nháp; chỉ nút “Thêm” mới lưu.
- Hạn nộp, lịch làm và nhắc hạn độc lập. Dùng `deadlineOn`/`dueDate`, `scheduledOn`/`scheduledStartAt`/`scheduledEndAt`; không ghi lịch mới vào `startDate` legacy.
- Người dùng sửa hoặc xóa thắng AI. Kết quả sai revision bị bỏ. AI lỗi vẫn thêm thủ công được.
- Ưu tiên mặc định Bình thường, dùng `isImportant`; không thêm thang P0–P3. Course ID phải được đối chiếu dữ liệu và quyền.
- Tái sử dụng giới hạn hiện tại: raw text 4.000 ký tự, title 200, description 3.000, tối đa 20 todo, mỗi todo 120. Luồng quick capture tạo một task; Smart Capture nhiều thẻ hiện tại vẫn tối đa 5.
- Không đọc cả hội thoại/cookie/token Teams hoặc Slack; không gửi HTML/raw DOM. Không ghi đoạn chọn, audio, token vào URL, telemetry hoặc log.
- Không thêm dịch vụ speech, queue, database task của extension, store account hay phát hành extension trong phạm vi này.
- Phụ thuộc contract [plan 01](2026-10-18-tasks-content-and-labels.md) và nhắc hạn [plan 02](2026-10-18-calendar-and-reminders.md). Đọc checkout lúc thực thi; trạng thái của plan cũ không chứng minh code hiện tại đã hoàn thành.

## Review Focus

1. Gõ tiếp, sửa chip hoặc bấm Thêm khi response AI/transcript còn chạy: không ghi đè hoặc xóa nháp mới — Task 2, 5, 6.
2. Mất response sau DB commit rồi retry, hoặc cùng id nhưng payload đổi: không tạo trùng, không nhận nhầm thành công — Task 4.
3. Tin nhắn cũ chứa “hôm nay”, giờ mơ hồ và máy ngoài múi giờ VN: không bịa thời điểm — Task 3, 7.
4. Login đổi tài khoản, popup đóng, worker extension khởi động lại: không chuyển nháp sang người khác hoặc mất âm thầm — Task 8.
5. Selection trong frame, password field, host bị thu hồi quyền hoặc nội dung độc hại: không đọc vượt quyền, không phá website — Task 7, 8, 9.

## Quyết định đề xuất và điểm chờ

| Điểm | Phương án cụ thể để khảo sát | Điều kiện trước bước phụ thuộc |
| --- | --- | --- |
| Q3 — kênh capture | Extension MV3 unpacked nội bộ; nút sát selection mở cửa sổ UniFlow nhỏ bằng `chrome.windows.create({type: "popup"})`. Đây là cửa sổ browser, không phải iframe nhúng vào Teams/Slack. | Task 1 ghi nhận selection/frame, vị trí popup, đăng nhập và transfer thật trên Edge. Chỉ triển khai Task 8 theo phương án đã kiểm chứng; phát hành store cần quyết định riêng. |
| Q6 — voice | Thử `SpeechRecognition`/`webkitSpeechRecognition`, `lang="vi-VN"`, không ghi audio bằng MediaRecorder. | Task 1 xác minh Edge có nhận tiếng Việt, stop/cancel và lỗi quyền. Có constructor chưa đủ kết luận hỗ trợ. Nếu không đạt, ghi lựa chọn speech service cùng luồng audio/retention để quyết định trước Task 6; không tự mua hoặc gọi dịch vụ mới. |
| Nhắc | Dùng contract reminder và `syncCardReminder` đang có từ phần 02. | Task 4 kiểm tra schema/rule offset đang dùng. Không thay worker hoặc hạ tầng Q2 trong plan này. |

Task 2–5 và 7 làm được độc lập với kết quả Q3/Q6. Khảo sát thất bại phải ghi rõ phần chưa đáp ứng; fallback nhập tay không được tính là hoàn thành voice hay WEB-01.

## Bản đồ file và contract hiện tại

Mọi path code dưới đây tính từ repository root `D:/Tool/UniFlow`. File mới là đích dự kiến; kiểm tra có phần tương đương trước khi tạo.

| Nhóm file | Trách nhiệm/thay đổi |
| --- | --- |
| `bkflow/lib/capture/{draft,analysis,source}.ts` và test tương ứng | State/provenance, kiểm output AI, nguồn và ngày tương đối; không thêm parser ngày thứ hai |
| `bkflow/lib/my-tasks/parse-quick-add.ts` và `.test.ts` | Giữ cú pháp `#môn`, `+tên`, `!`, `@mai`; phân biệt hạn ngày-only khi mở rộng |
| `bkflow/actions/ai/analyze-smart-capture/{index,schema,types}.ts` | Thêm mode quick một task; giữ mode Smart Capture nhiều thẻ |
| `bkflow/actions/cards/{quick-add-card,create-smart-capture-card}/{index,schema,types}.ts` | Chung validation và lưu atomic; giữ callers cũ |
| `bkflow/lib/cards/create-captured-cards.ts`, `.test.ts`, `captured-cards-effects.ts` | Tái sử dụng idempotency, todo transaction và effects sau commit |
| `bkflow/components/my-tasks/quick-add-bar.tsx`, `bkflow/components/capture/capture-composer.tsx`, `bkflow/hooks/use-capture-voice.ts` | UI chung và vòng đời voice |
| `bkflow/web/routes/capture.tsx`, `bkflow/web/router.tsx` | Cửa sổ `/capture`, login trong cùng trang và composer chung |
| `extensions/uniflow-capture/{manifest.json,background.js,selection.js,bridge.js,options.html,options.js}` | MV3 JavaScript thuần, host grant, nút chọn và chuyển nháp; không thêm framework/build pipeline |
| `extensions/uniflow-capture/{protocol.test.mjs,README.md}` | Test giao thức bằng Node; hướng dẫn load unpacked và quyền |
| `bkflow/server/app.ts`, `bkflow/scripts/gen-action-registry.ts` | Chỉ chỉnh nếu cần gắn rate limit/registry theo pattern hiện hữu; không tạo API AI riêng |

Hiện `QuickAddBar` vẫn gọi action riêng chỉ nhận dueDate, không có idempotency. Creator Smart Capture đã có `creationId`, replay và transaction todo, nhưng schema chưa mang đủ lịch/nhắc. Supabase access token được `web/lib/auth-fetch.ts` gắn vào request cùng origin; extension không được sao chép cơ chế lấy token.

Các callers phải kiểm khi đổi composer: `components/my-tasks/today-view.tsx`; `app/(platform)/(dashboard)/board/[boardId]/list/_components/board-list-view.tsx`; `todo/_components/board-todo-view.tsx`; `_components/smart-capture-dialog.tsx`; `_components/board-options.tsx` (ba path cuối cùng dưới cùng board directory). Giữ props `defaults`, `trailing`, `compact`, `onCreated`, read-only và course/member selection.

## Cách chạy kiểm tra

Các lệnh npm/tsx dưới đây chạy tại `D:/Tool/UniFlow/bkflow`. Lệnh Node extension chạy tại repository root. Không thêm test framework cho logic thuần; dùng `node:test` và `assert/strict` như repo hiện tại.

Mỗi task logic có vòng RED → GREEN dưới đây. RED phải thất bại đúng assertion/hàm chưa có, không tính lỗi môi trường là bằng chứng. Browser checks dùng trình duyệt hiện có; nếu cần runner mới, quyết định riêng thay vì tự thêm dependency. Test component qua UI thật; mock AI/network không thay bằng chứng DB hoặc Edge thật.

### Task 1: Khảo sát Q3/Q6, chốt đường thực thi

**Files:** ghi kết quả ngay tại mục “Kết quả khảo sát” cuối plan này; prototype tạm trong `.superpowers/spikes/quick-capture-20261019/`, không đưa script thử vào sản phẩm.

**Interfaces:** đầu ra là `Q3: pass|blocked`, host/frame đã thử, origin UniFlow cụ thể và `Q6: pass|blocked`, phiên bản Edge, hành vi tiếng Việt và luồng audio. Không có API sản phẩm mới.

- [ ] Thử selection trên Teams web và Slack web bằng tài khoản thử được phép: top frame/cross-origin frame, selection thay đổi, scroll, Escape/Tab; ghi host chính xác cần xin quyền. Không thu thập nội dung hội thoại ngoài đoạn được chọn.
- [ ] Thử MV3 mở popup top-level tới `/capture`; kiểm session Supabase của tab UniFlow và popup, login/logout, redirect auth và transfer bằng bridge content script. Origin production lấy từ cấu hình triển khai đã xác minh, không đoán hostname.
- [ ] Thử tiếng Việt trên Edge với quyền allow/deny, stop/abort/unmount, offline và kết quả tới trễ. Ghi browser có gửi âm thanh tới dịch vụ nhận dạng hay không theo tài liệu nhà cung cấp; không gọi là xử lý local chỉ vì dùng API browser.
- [ ] Ghi bằng chứng và kết luận Q3/Q6. Nếu popup hoặc voice không đạt, giữ các task độc lập; cập nhật thiết kế phần bị chặn trước khi viết code phụ thuộc. Không tự đổi sang bookmarklet, menu chuột phải hay dịch vụ speech như thể người dùng đã chọn.

### Task 2: Nháp chung có revision và quyền ưu tiên của người dùng

**Files:** tạo `bkflow/lib/capture/draft.ts`, `draft.test.ts`.

**Interfaces:** `CaptureDraft` có `draftId`, `textRevision`, rawText, source; mỗi field là `{value, origin: "manual"|"inferred"|"unset"}`. Field gồm title, deadline (`TaskDeadline`), schedule (`TaskSchedule`), reminder (contract hiện có hoặc null), isImportant, courseId và checklistItems. Null với origin manual là xóa có chủ đích. `mergeCaptureAnalysis(draft, {draftId,textRevision,fields}): CaptureDraft`; `setCaptureField(draft,key,value): CaptureDraft`; `captureReducer(state,event): CaptureState` cho analyze/submit/result.

- [ ] Viết `manual clear survives reanalysis`, `stale revision ignored`, `old draft response ignored`, `save clears only submitted snapshot`: title manual “Bài sửa” giữ nguyên sau AI “Bài A”; deadline manual null không được AI thêm lại; gửi revision 2 rồi nhập revision 3, success không xóa revision 3.
- [ ] RED: `npx tsx --import ./server/register-aliases.mjs --test lib/capture/draft.test.ts`.
- [ ] Implement các hàm trên bằng state thuần, không thêm store toàn cục. Mỗi edit text tăng revision; AI chỉ thay inferred/unset, response sau submit không merge lại nháp đã gửi. Khi đổi text, bỏ inference cũ không còn đúng revision, giữ lựa chọn manual.
- [ ] GREEN: chạy lại lệnh RED, tất cả assertions PASS; thêm trường hợp hai request hoàn thành ngược thứ tự và lựa chọn mới trong lúc đang lưu.

### Task 3: Nhận diện câu ngắn, giữ tương thích Smart Capture

**Files:** sửa action `analyze-smart-capture/{index,schema,types}.ts`, parser quick-add và test; tạo `bkflow/lib/capture/analysis.ts`, `analysis.test.ts`.

**Interfaces:** input action thêm `mode?: "board"|"quick"` (default board), `draftId`, `textRevision`, `timeZone` IANA và source context đã validate. Quick output là một draft fields của Task 2 cùng `issues: {field,reason}[]`; board output hiện tại không đổi shape. `validateCaptureAnalysis(raw: unknown, context): CaptureAnalysis` kiểm model JSON và thời gian; không coi rawText là system instructions.

Định nghĩa `CaptureAnalysis` trong `lib/capture/analysis.ts` gồm `{draftId: string, textRevision: number, fields: Partial<CaptureFields>, issues: {field: keyof CaptureFields, reason: string}[]}`; `CaptureFields` là map giá trị của các field Task 2, không chứa provenance. `context` có `{draftId, textRevision, referenceIso, timeZone, allowedCourseIds: string[]}`. Action có overload/type phân biệt quick và board để caller cũ không phải đoán union khi đọc `drafts`; trả nguyên revision của request, merge ở client vẫn kiểm state hiện tại.

- [ ] Viết table test `quick sentence matrix` với anchor `2026-10-18T03:00:00Z`, `Asia/Ho_Chi_Minh`: “Nộp bài A trước 17h30 hôm nay” → dueDate `2026-10-18T10:30:00Z`, schedule rỗng; “Học bài A ngày mai từ 19h đến 20h” → start/end `2026-10-19T12:00:00Z`/`13:00:00Z`, deadline rỗng.
- [ ] Thêm assertions bốn câu còn lại của CAP-01: “tối mai” → scheduledOn `2026-10-19`, chưa bịa giờ; “nộp thứ ba 17h” → dueDate `2026-10-20T10:00:00Z`; “Đọc tài liệu A” không ngày; “5 giờ” có issue sáng/chiều; yêu cầu chia bước chỉ có todo tổng quát sửa được. Test deadline ngày-only không thành 23:59, ngày quá khứ không tự cộng tuần, hai hạn mâu thuẫn chỉ đánh dấu field deadline.
- [ ] RED: `npx tsx --import ./server/register-aliases.mjs --test lib/capture/analysis.test.ts lib/my-tasks/parse-quick-add.test.ts`.
- [ ] Mở rộng action đang có, dùng `generateAiText`/`parseAiJson` và provider hiện tại; không sao chép action AI thành endpoint khác. Quick mode không bị minimum-content rule dành cho đoạn board dài chặn câu ngắn hợp lệ; không thay rule board mode âm thầm. Validator dùng `TaskDeadlineSchema`, `TaskScheduleSchema`; course đối chiếu danh sách được phép. Reuse parser cho token, AI cho ngữ nghĩa câu tự nhiên; không viết regex engine hiểu mọi câu tiếng Việt.
- [ ] GREEN: chạy lại suite; thêm fixture JSON sai schema, timeout, course lạ, title JSON/error, prompt injection và board-mode tối đa 5 draft. Unit test dùng fixture output xác định; live AI chạy lại sáu câu và ghi kết quả riêng, không coi mock là bằng chứng chất lượng model.

### Task 4: Tạo task + todo + nhắc trong transaction, retry an toàn

**Files:** sửa hai action tạo quick-add/Smart Capture (schema, index, types), `lib/cards/create-captured-cards.ts`, `.test.ts`, effects; reuse `task-schedule.ts`, `task-schedule-storage.ts`, `lib/notifications/reminder-deliveries.ts`.

**Interfaces:** mở rộng draft input creator bằng TaskDeadline/TaskSchedule, reminder hợp lệ, myDay và trạng thái quan trọng hiện tại; giữ `creationId` UUID → Card.id. Quick-add nhận `creationId` optional để tương thích callers cũ, composer mới luôn truyền UUID ổn định; resolve board/list như action cũ rồi gọi `createCapturedCardsWithStatus`. Không tạo đường insert card thứ ba.

- [ ] Viết tests `all capture fields survive create and replay`, `todo or reminder failure rolls back whole creation`, `same id changed schedule is conflict`, `foreign ids rejected without leak`, `lost response retries exactly once`. Assert một Card, đúng todo, đúng lịch/ngày-only/reminder; hai request đồng thời không thêm card/checklist thứ hai.
- [ ] RED: `npx tsx --import ./server/register-aliases.mjs --test lib/cards/create-captured-cards.test.ts`.
- [ ] Extend validation trước write: ngày thật, start < end, không đồng thời ngày-only/giờ, reminder theo contract 02, course/list/label/member đúng quyền. Không âm thầm filter course/label sai thành thành công. Giữ tương thích `myDay`, `isImportant` và assignee của quick-add; không làm rơi props cũ khi chuyển creator.
- [ ] Mở rộng transaction hiện có: card, user state, todo và `syncCardReminder` cùng transaction; dùng storage adapters cho DATE/ISO. Replay so sánh toàn bộ nội dung có ý nghĩa mới, gồm priority/myDay/assignee và nguồn mô tả; kiểm UUID trùng khác user/board như hiện tại. Payload/id snapshot đóng băng cho retry; đổi payload sau submit không dùng lại id cũ để ghi đè.
- [ ] Effects chạy sau commit và chỉ cho `createdIds`; lỗi audit/realtime không được khiến client tưởng chưa lưu và tạo id mới. GREEN: suite trên PASS, thêm lỗi effects sau commit và replay không phát effects lần hai. Chạy một test DB tích hợp trên DB thử được phép để chứng minh rollback thật; fake DB không thay thế bước này.

### Task 5: Composer inline và kết nối toàn bộ callers

**Files:** tạo `components/capture/capture-composer.tsx`; sửa `components/my-tasks/quick-add-bar.tsx` và callers trong bản đồ file; adapter trong `lib/capture/draft.ts` nếu cần. Giữ SmartCaptureDialog nhiều thẻ, chỉ tái sử dụng hợp đồng chung.

**Interfaces:** `CaptureComposer` nhận context board/list/courses/members/defaults và `initialSource?`, callback `onCreated(card)`; QuickAddBar giữ public props hiện tại. Snapshot submit gửi qua action quick-add đã mở rộng ở Task 4. Chỉ một draft/card cho composer quick.

- [ ] Viết reducer tests `analyzing submit requires explicit choice`, `failed save keeps snapshot and id`, `empty title blocks`, `manual create when AI unavailable`; RED bằng lệnh Task 2.
- [ ] Implement input và chip sửa/xóa hạn, lịch, khoảng nhắc, ưu tiên, course, todo. Nút “Thêm” rõ ràng, Enter theo cùng handler, IME đang composition không submit. Preview ngày tuyệt đối gồm năm và timezone; issue chỉ yêu cầu sửa field mơ hồ, không bắt nhập lại cả form. Thêm khi AI đang chạy cho chọn chờ hoặc “Thêm với thông tin hiện có”.
- [ ] Khóa submit bằng snapshot synchronously, bắt cả thrown network error và ActionState lỗi; không clear sớm. Khi không rõ đã lưu, retry cùng id/payload; muốn thay nội dung phải kiểm trạng thái lần gửi trước bằng retry trước, tránh tạo bản mới khi bản cũ có thể đã lưu. Thành công chỉ clear snapshot tương ứng và invalidate query/callback như callers cũ.
- [ ] GREEN reducer tests. Browser assertions: AI off/timeout → nhập tay thêm được; sửa/xóa chip → AI về không ghi đè; double click/Enter → một task; gõ nội dung mới khi saving → success giữ nội dung mới. Kiểm today/list/todo/read-only, defaults myDay, course/member, slot trailing; desktop và màn 390px, Tab/Enter/Escape, nhãn screen reader và focus sau lỗi.

### Task 6: Voice vào chính composer, không tự lưu

**Gate:** Q6 Task 1 đạt hoặc phương án thay thế đã được quyết định; không coi nút mic disabled là đã hoàn thành CAP-05 cho voice.

**Files:** tạo `bkflow/hooks/use-capture-voice.ts`; logic revision/session thuần đặt trong `lib/capture/draft.ts` và test; nối `capture-composer.tsx`.

**Interfaces:** `useCaptureVoice({draftId,textRevision,onTranscript}): {status,start,stop,cancel,error}`; status `idle|listening|stopping|transcribing|error`. Transcript event kèm draftId/revision và session id; không gọi API tạo task.

- [ ] Viết `late transcript cannot overwrite typing`, `cancel invalidates final result`, `permission denied keeps text`, `voice never submits`; fake recognition adapter chỉ phục vụ test vòng đời. RED bằng suite draft của Task 2.
- [ ] Sau click mic mới tạo/start recognition; đặt tiếng Việt và đọc final transcript, interim chỉ preview. Stop hoàn tất nhận dạng; cancel/unmount abort, tháo listeners và bỏ callback session cũ. Nhập mới trong lúc nghe khiến transcript trễ cần chọn “Chèn bản chép lời”, không tự thay text mới.
- [ ] GREEN test và thử mic Edge thật: allow/deny, không thiết bị, unsupported, stop, chuyển trang, final event sau cancel. Hiện thông báo luồng dữ liệu nhận dạng đã xác minh ở Task 1 trước khi bắt đầu; không tự lưu audio. Gõ tay luôn hoạt động khi voice lỗi.

### Task 7: Nguồn capture, thời gian tin nhắn và dữ liệu không tin cậy

**Files:** tạo `bkflow/lib/capture/source.ts`, `source.test.ts`; dùng trong action AI, composer và action create.

**Interfaces:** `CaptureSourceSchema` có selectedText (1–4.000), pageUrl?, pageTitle?, messagePermalink?, messageSentAt?, capturedAt, timeZone. `normalizeCaptureSource(input: unknown): CaptureSource`; `getCaptureTimeContext(source): {referenceIso,requiresRelativeDateConfirmation}`. Provenance “verified message timestamp” chỉ do adapter đã được khảo sát cung cấp; tuyệt đối không suy từ capturedAt.

- [ ] Viết `old message today uses sent date`, `unknown sent date requires confirmation`, `page link is not message permalink`, `unsafe URLs and oversized selection rejected`. Fixture sentAt `2026-10-12T03:00:00Z`, capturedAt `2026-10-18T03:00:00Z`, “hôm nay 17h” phải thành Oct12 17h VN và cảnh báo quá khứ; thiếu sentAt phải xác nhận ngày tuyệt đối trước submit. RED: `npx tsx --import ./server/register-aliases.mjs --test lib/capture/source.test.ts`.
- [ ] Implement schema và sanitize URL: chỉ http/https, bỏ credentials, fragment và query không được allowlist; khi không biết permalink thật, lưu nhãn “Trang nguồn”. MVP không có adapter timestamp chắc chắn thì luôn để messageSentAt rỗng; không đọc cả DOM hội thoại để đoán. Giới hạn pageTitle 200, URL 2.048 ký tự là MD của plan.
- [ ] Lưu trích đoạn + nguồn thành phần mô tả có nhãn rõ, trong giới hạn description 3.000; UI cho xem bản cuối và sửa trước submit. Không âm thầm truncate nguồn vượt giới hạn; yêu cầu rút gọn hoặc bỏ đính kèm nguồn, giữ văn bản nháp. Render plain text/escaped Markdown, không HTML, kiểm URL cả server lẫn lúc mở link. Không thêm bảng nguồn khi description hiện tại đã đáp ứng.
- [ ] GREEN: suite trên PASS; thêm HTML/script, Markdown link `javascript:`, chỉ dẫn giả system, timezone sai, nguồn quá dài. Việc xác nhận chip gắn revision + giá trị ngày; đổi selection/ngày phân tích phải mất xác nhận cũ. Validate payload server không tin flag timestamp/confirmation từ trang ngoài là bằng chứng quyền.

### Task 8: Extension nội bộ và popup UniFlow có xác thực

**Gate:** Q3 Task 1 đạt. Thực hiện sau Tasks 2–5, 7. Không thêm token, CORS wildcard, `externally_connectable` hay endpoint tạo task công khai.

**Files:** tạo các file extension trong bản đồ; tạo `bkflow/web/routes/capture.tsx`; sửa router; tạo `bkflow/web/lib/capture-bridge.ts`, `capture-bridge.test.ts`. Mọi origin/host là allowlist cụ thể từ Task 1, không `<all_urls>`.

**Interfaces:** giao thức version 1: `CAPTURE_REQUEST`, `CAPTURE_READY`, `CAPTURE_DRAFT`, `CAPTURE_BIND`, `CAPTURE_SAVED`, `CAPTURE_CANCEL`. Envelope có `requestId` UUID và version; worker lưu `{source,sourceTabId,sourceFrameId,targetTabId,expiresAt,boundUserId?}` trong `chrome.storage.session`, TTL 15 phút (MD). Không có access/refresh token. App luôn xác thực lại qua auth hiện có.

- [ ] Viết `no transfer before trusted button click`, `wrong tab frame origin nonce rejected`, `expired draft not delivered`, `changed account requires rebind`, `worker restart retains pending draft`; RED: từ root chạy `node --test extensions/uniflow-capture/protocol.test.mjs`; từ bkflow chạy `npx tsx --import ./server/register-aliases.mjs --test web/lib/capture-bridge.test.ts`. Tests import logic thực của background/bridge, mock chrome API tối thiểu.
- [ ] Options cho bật từng host trong allowlist đã khảo sát và UniFlow origin cố định của bản build. Dùng `optional_host_permissions`, `scripting`, `storage`; register content script chỉ sau grant, unregister khi revoke. Không xin history/cookies/all tabs. Không dùng `activeTab` thay host grant nếu yêu cầu nút tự hiện sau selection.
- [ ] Selection script đọc đúng `getSelection().toString()` và bounding rect sau selection trên host được cấp quyền, bỏ password/editable nhạy cảm; chỉ hiện nút “Thêm vào UniFlow”. Không network/storage snippet trước click. Click thật (`isTrusted`) mới gửi schema-bounded payload tới worker; không nghe page `postMessage` để mở capture. Frame chỉ chạy khi origin frame được cấp quyền; không vượt boundary bằng đọc DOM cha.
- [ ] Worker kiểm `sender.id`, sender tab/frame/url, host grant và schema; tạo requestId rồi mở popup top-level `/capture#request=<opaque-id>` gần nút, clamp theo màn hình. Chỉ ID nằm URL, không nội dung. Lưu targetTabId; bridge content script chỉ trên origin UniFlow. App READY → bridge → runtime → worker kiểm target tab/top frame/origin/id → trả draft. `postMessage` giữa app/bridge kiểm `event.source===window`, exact origin, type/version/id; gửi exact targetOrigin, không `*`. Xử lý READY tới sớm bằng retry handshake có timeout, không chuyển snippet sang tab khác.
- [ ] Route capture hiển thị account và chọn board/list có quyền; dùng Supabase trong origin UniFlow và `auth-fetch` hiện tại. Nếu chưa login, giữ request trong worker và mở UI login ngay cửa sổ này để không mất request qua redirect. Sau login người dùng xác nhận account nhận nháp; bind userId, không tự tạo. Logout/account đổi đóng băng submit và yêu cầu xác nhận chuyển hoặc hủy; server luôn dùng auth user thật, không tin boundUserId client để cấp quyền.
- [ ] Retry backend giữ snapshot/id tại composer; worker giữ bản nguồn đến SAVED/cancel/expiry. Bridge không chuyển token/payload nhạy cảm ngược về source tab; chỉ gửi success + task link đã kiểm origin khi cần. Đóng popup giữ nguồn để mở lại trong TTL, không giả lưu được mọi chỉnh sửa chưa gửi; cảnh báo rõ khi đóng có sửa chưa lưu. Expiry xóa dữ liệu, không báo đã tạo task. Chọn đoạn mới tạo request mới hoặc hỏi thay nháp, không trộn.
- [ ] GREEN hai suite. Thử thực tế login/logout, worker restart, hai popup/hai tab, account A→B, mạng mất sau commit, thu hồi host grant và backend lỗi. Popup có Escape đóng, Tab/focus, không phá selection website. Viết README load unpacked chủ động, cấu hình origin, host scope, TTL và gỡ quyền; không tự cài lên trình duyệt của người dùng.

### Task 9: Nghiệm thu end-to-end và ghi giới hạn thật

**Files:** cập nhật bằng chứng tại mục cuối plan; extension README; chỉ chỉnh test/config hiện tại nếu thay đổi thực sự cần. Không thêm trang fixture vào build production.

**Interfaces:** bảng kết quả dưới đây phân biệt unit, DB, browser fixture và live Teams/Slack/AI/mic. Chỉ đánh dấu đạt khi có bằng chứng tương ứng.

- [ ] Chạy `npm test`, `npx tsc --noEmit`, `npm run build`; ESLint các file thay đổi. Registry action tạo bằng `npm run gen:actions` (đã nằm trong build); không sửa registry thủ công. Test extension từ root như Task 8. Không chạy build đồng thời.
- [ ] Trên DB thử được phép: task+todo+reminder atomic, rollback lỗi giữa transaction, replay UUID sau commit, thay payload cùng UUID bị conflict, scope user/board sai bị từ chối. Xác minh reminder được nối contract 02, không tuyên bố push đã tới máy chỉ vì tạo delivery thành công.
- [ ] Thử UI desktop/màn 390px và máy đặt timezone ngoài VN, IME tiếng Việt, bàn phím, AI lỗi và response chậm. Auth/rate limit giữ cùng policy capture nội bộ; nếu chưa có limiter, gắn limiter theo user trước gọi model và create tại action dispatch hiện tại, có test 429 giữ nháp; không bịa một quota tùy ý hoặc mở API không giới hạn.
- [ ] Trên Teams và Slack thật: chọn → nút → popup → chỉnh → một task có todo/nguồn → mở lại task kiểm dữ liệu. Dùng network inspector xác minh chỉ chọn chưa click không gửi snippet; logged out không đưa snippet vào URL/log. Kiểm tin cũ/không sentAt, frame không hỗ trợ, CSP/policy chặn và host chưa grant; fallback hướng copy/paste vào cùng composer, không chặn website.
- [ ] Chỉ đánh dấu toàn bộ hoàn thành khi đủ CAP/WEB dưới đây. Nếu không có tài khoản thử/mic/browser phù hợp, ghi “chưa kiểm” cùng bước tái hiện; không coi unit pass là thay thế. Không phát hành store; khảo sát phí/chính sách chính thức lại khi có yêu cầu phát hành.

## Truy vết nghiệm thu

| Tiêu chí | Task | Bằng chứng bắt buộc |
| --- | --- | --- |
| CAP-01 | 3, 5, 9 | Sáu câu cố định, preview tuyệt đối, fixture + live AI riêng |
| CAP-02 | 2, 5 | Manual edit/clear, response đảo thứ tự/sai revision |
| CAP-03 | 3, 5 | AI off/timeout, tạo tay thành công, nháp còn |
| CAP-04 | 4, 5, 9 | Double submit, retry sau DB commit, đúng một Card |
| CAP-05 | 1, 6 | Mic allow/deny, late transcript, unmount, không tự submit |
| CAP-06 | 4, 9 | DB rollback card+todo, không false success |
| WEB-01 | 1, 8, 9 | Teams và Slack thật, popup→sửa→một task không gõ lại |
| WEB-02 | 8, 9 | Network không snippet trước click; không đọc host thiếu grant |
| WEB-03 | 8, 9 | Login/backend lỗi giữ nguồn; không snippet URL; account binding |
| WEB-04 | 3, 7, 9 | SentAt cũ hoặc không rõ; xác nhận ngày theo revision |
| WEB-05 | 7, 8 | Nhãn Trang nguồn, URL an toàn, injection inert |
| WEB-06 | 1, 8, 9 | Frame/policy fail có fallback; website vẫn dùng được |

## Kết quả khảo sát và thực thi

Thực thi ngày 19/10/2026 trong container Linux (Node 22, Chromium 141 headless của Playwright, PostgreSQL 16 cục bộ tạm). Không có Edge, tài khoản Teams/Slack, micro hay `OPENAI_API_KEY`.

### Task 1 — Q3/Q6: **blocked (chưa khảo sát)**

- Q3: chưa thử extension MV3, selection trên Teams/Slack web, popup `/capture` hay login trên Edge. Chưa có origin production đã xác minh. → **Task 8 không triển khai** (gate chưa đạt); WEB-01/02/03/06 chưa đạt.
- Q6: chưa thử `SpeechRecognition` tiếng Việt trên Edge, quyền mic, luồng audio. → **Task 6 không triển khai**; CAP-05 chưa đạt. Không có nút mic disabled giả hoàn thành.
- Bước tái hiện: chạy đúng các bullet của Task 1 trên Edge thật với tài khoản thử được phép, ghi phiên bản/host/origin vào đây.

### Đã làm (Task 2, 3, 4, 5, 7) và bằng chứng

| Task | File | Bằng chứng |
| --- | --- | --- |
| 2 | `bkflow/lib/capture/draft.ts`, `draft.test.ts` | Unit: manual clear survives reanalysis, stale revision/old draft ignored, response đảo thứ tự, save chỉ xóa snapshot đã gửi, lựa chọn mới lúc đang lưu được giữ |
| 3 | `bkflow/lib/capture/analysis.ts`, `analysis.test.ts`; `actions/ai/analyze-smart-capture/{index,schema,types}.ts`; `lib/my-tasks/parse-quick-add.ts` (+`deadlineOn`) | Unit fixture: ma trận câu CAP-01 (17h30 hôm nay, 19h–20h mai, tối mai = scheduledOn, thứ ba 17h, không ngày), “5 giờ” có issue, ngày-only không thành 23:59, ngày quá khứ giữ + cảnh báo, hai hạn mâu thuẫn chỉ đánh dấu deadline, JSON sai, course lạ/prompt injection, title JSON/error, DST. Board mode giữ nguyên shape; overload type phân biệt quick/board |
| 4 | `actions/cards/{quick-add-card,create-smart-capture-card}/*`, `lib/cards/create-captured-cards.ts`, `.test.ts`, `.db.test.ts`, `captured-cards-effects.ts`, `capture-error-codes.ts` | Unit (fake DB) + **PostgreSQL 16 thật** (`CAPTURE_DB_TEST=1`): rollback card+todo+user state khi ghi delivery lỗi giữa transaction, mọi field lưu đúng (deadlineOn/scheduled*/reminder/isImportant/myDay, `startDate` không bị ghi), replay sau commit không tạo bản 2 và không phát effects lần 2, cùng id đổi lịch → conflict, 2 request đồng thời → 1 card, sai user/board/course bị từ chối không ghi. Quick-add giờ đi qua cùng creator (không còn đường insert riêng) |
| 5 | `components/capture/capture-composer.tsx`, `components/my-tasks/quick-add-bar.tsx` | Reducer tests + harness trình duyệt tạm (Chromium, action mock qua fetch, máy đặt timezone New York): AI off → thêm tay; double Enter/click → 1 request; gõ lúc đang lưu giữ nội dung mới; mất mạng → “Thử lại” gửi lại đúng id/payload cũ; xóa chip → AI không thêm lại; Enter khi AI chạy → hỏi “Chờ AI / Thêm với thông tin hiện có”, kết quả AI trễ bị bỏ; issue “5 giờ” sửa bằng tay; Escape đóng chi tiết; 390px không cuộn ngang; read-only disabled + hint |
| 7 | `bkflow/lib/capture/source.ts`, `source.test.ts` | Unit: tin cũ dùng sentAt (chỉ từ adapter đã kiểm chứng, MVP chưa có → luôn rỗng), thiếu sentAt phải xác nhận ngày (gắn revision + giá trị), link trang ≠ permalink (“Trang nguồn”), URL không an toàn/selection quá dài bị từ chối, HTML/script/Markdown link `javascript:` inert, nguồn quá dài báo lỗi không truncate. Server từ chối mô tả có link scheme lạ |

Lệnh: `npm test` (284 pass, 0 fail), `npx tsc --noEmit` sạch, `npm run build` thành công, ESLint các file đổi: không lỗi mới (lỗi `"use server"` dòng 2 của `analyze-smart-capture/index.ts` và các warning `_list`, `members` có từ trước). DB: `CAPTURE_DB_TEST=1 DATABASE_URL=<db thử> npx tsx --import ./server/register-aliases.mjs --test lib/cards/create-captured-cards.db.test.ts` → 5/5 pass.

### Giới hạn và phần chưa kiểm

- RED: phần lớn test được viết cùng lúc với code, không có lần chạy RED riêng ghi lại cho từng task.
- Live AI: chưa chạy sáu câu CAP-01 với model thật (không có key); chỉ có fixture. CAP-01 chưa đủ bằng chứng.
- Browser: harness dùng action mock, không qua auth Supabase/DB thật; chưa thử IME tiếng Việt thật (chỉ chặn `isComposing`/keyCode 229 trong code), chưa thử screen reader.
- Task 9 rate limit: repo chưa có limiter; chưa gắn vì plan yêu cầu không bịa quota — cần quyết định quota/user trước.
- Assignee: quick-add cũ nhận `assigneeUserIds` nhưng không lưu; giữ nguyên hành vi (workspace cá nhân), replay không so assignee.
- Task 6, 8 và phần live Teams/Slack của Task 9: chưa làm (gate Q3/Q6).

## Tài liệu nền cho khảo sát

Đối chiếu ngày 19/10/2026; các API dưới đây chỉ là cơ sở thiết kế, không chứng minh tương thích với môi trường thực tế:

- [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts): isolated world, injection và frame/host boundary.
- [Chrome permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions): quyền hẹp và quyền tùy chọn.
- [Chrome windows API](https://developer.chrome.com/docs/extensions/reference/api/windows): mở cửa sổ popup top-level và vị trí cửa sổ.
- [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage): storage.session cho nháp tạm của extension.
- [Chrome messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging): xác minh message ở trust boundary.
- [MDN postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage): exact target origin và kiểm source/origin.
- [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition): kiểm khả năng trình duyệt và xử lý nhận dạng phía dịch vụ; không mặc định audio ở local.
