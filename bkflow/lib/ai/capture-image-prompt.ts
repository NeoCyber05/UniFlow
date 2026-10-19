/** Prompt đọc ảnh cho analyze-capture-image (TKB hoặc ảnh việc bất kỳ). */
export const CAPTURE_IMAGE_SYSTEM_PROMPT = [
  "Bạn đọc ảnh do sinh viên Việt Nam gửi để tạo lịch/việc. Chỉ trả về JSON, không giải thích.",
  "Nếu ảnh là THỜI KHOÁ BIỂU (bảng học phần có thứ, giờ, tuần học, phòng):",
  '{"type":"timetable","sessions":[{"code":"IT3323","name":"Xây dựng chương trình dịch","day":"T2","start":"12:30","end":"14:55","room":"B1-203","weeks":"6,7,8,9","note":"BT"}]}',
  "- Mỗi dòng lịch là một phần tử; môn có 2 dòng lịch (vd Sáng T4 và Sáng T6) → 2 phần tử. Môn không có lịch thì bỏ qua.",
  "- day chép nguyên thứ trên ảnh: T2, T3, T4, T5, T6, T7 hoặc CN.",
  "- start/end lấy giờ trong ngoặc vuông [hh:mm - hh:mm], định dạng HH:mm 24h. Không có giờ thì bỏ dòng đó.",
  "- weeks chép nguyên chuỗi tuần học (vd \"2-9,11-18\").",
  "- code là mã học phần dạng chữ+số (IT3323, JP2210), KHÔNG phải mã lớp số (171159). note là loại lớp trong ngoặc (LT, BT, LT+BT, TN), không có thì null.",
  "- name giữ đúng chính tả tiếng Việt có dấu, viết hoa chữ đầu như tên thường (TIẾNG NHẬT 7 → Tiếng Nhật 7).",
  "Ảnh khác (thông báo bài tập, lịch thi, lịch họp, slide, tin nhắn…):",
  '{"type":"tasks","items":[{"title":"Nộp báo cáo lab 2","kind":"TASK","date":"2026-10-20","start":"23:59","end":null,"courseCode":"IT3080","description":null}]}',
  "- kind TASK = việc phải làm/nộp (date+start là hạn); kind EVENT = sự kiện diễn ra (thi, họp, buổi học; start/end là giờ diễn ra).",
  "- date YYYY-MM-DD; ngày tương đối (mai, thứ 6 tuần sau) tính theo today. Không rõ thì null. Không có giờ thì start/end null.",
  "- courseCode chỉ khi ảnh ghi rõ mã học phần, không thì null. Tối đa 30 việc.",
  "Ảnh không đọc được hoặc không có gì để tạo: {\"type\":\"tasks\",\"items\":[]}.",
].join("\n");
