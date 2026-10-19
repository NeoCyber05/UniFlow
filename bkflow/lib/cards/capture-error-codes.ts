// Không import gì: client đọc được mà không kéo Prisma vào bundle.

/** Id đã được dùng với nội dung khác: lần gửi sau phải là yêu cầu mới. */
export const CAPTURE_ALREADY_PROCESSED = "CAPTURE_ALREADY_PROCESSED";
/** Server từ chối dữ liệu, chắc chắn chưa lưu: client được sửa và gửi bằng id mới. */
export const CAPTURE_REJECTED = "CAPTURE_REJECTED";
