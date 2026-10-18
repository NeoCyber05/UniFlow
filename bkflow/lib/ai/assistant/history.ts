import "server-only";

import type { Prisma } from "@prisma/client";
import type { UIMessage } from "ai";

import { db } from "@/lib/db";

import { ASSISTANT_LIMITS } from "./config";

/**
 * Phạm vi định danh lưu trữ lịch sử cuộc hội thoại của Trợ lý AI.
 * Đảm bảo dữ liệu chat được cô lập theo từng bảng và từng người dùng cụ thể.
 */
type HistoryScope = {
  /** ID bảng làm việc hiện tại */
  boardId: string;
  /** ID người dùng đang tham gia trò chuyện */
  userId: string;
};

/**
 * Trích xuất toàn bộ văn bản thuần túy (plain text) từ các phần tử con (`parts`) của một tin nhắn UI.
 *
 * @param message - Tin nhắn `UIMessage` cần trích xuất (từ Vercel AI SDK).
 * @returns Chuỗi văn bản đã ghép nối và loại bỏ khoảng trắng thừa đầu cuối.
 */
const extractText = (message: UIMessage): string =>
  message.parts
    .filter((part): part is Extract<UIMessage["parts"][number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

/**
 * Tải danh sách tin nhắn lịch sử trò chuyện gần nhất giữa người dùng và Trợ lý AI trên một bảng.
 *
 * @remarks
 * - Lấy tối đa `ASSISTANT_LIMITS.historyMessages` (mặc định 30) tin nhắn gần nhất từ cơ sở dữ liệu (`BoardAiChat`).
 * - Đảo ngược thứ tự thời gian (`reverse()`) để trả về luồng tin nhắn theo thứ tự tăng dần từ cũ đến mới.
 * - Khôi phục cấu trúc `parts` đa phương tiện (chứa text, tool call invocations, action cards) nếu có;
 *   nếu `parts` rỗng/null, fallback tạo một text part duy nhất từ trường `content`.
 *
 * @param scope - Đối tượng chứa `boardId` và `userId` để lọc lịch sử.
 * @returns Mảng các tin nhắn `UIMessage` đã sẵn sàng để hiển thị trên giao diện hoặc inject vào ngữ cảnh hội thoại.
 *
 * @throws {Error} Nếu xảy ra lỗi truy vấn cơ sở dữ liệu với Prisma.
 */
export const loadAssistantHistory = async ({ boardId, userId }: HistoryScope): Promise<UIMessage[]> => {
  const rows = await db.boardAiChat.findMany({
    where: { boardId, userId },
    orderBy: { createdAt: "desc" },
    take: ASSISTANT_LIMITS.historyMessages,
  });

  return rows.reverse().map((row) => ({
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    parts: Array.isArray(row.parts)
      ? (row.parts as unknown as UIMessage["parts"])
      : [{ type: "text", text: row.content }],
  }));
};

/**
 * Lưu trữ danh sách các tin nhắn mới phát sinh (người dùng hoặc trợ lý) vào cơ sở dữ liệu
 * thông qua một giao dịch an toàn (Prisma transaction).
 *
 * @remarks
 * - Chỉ lưu các tin nhắn có vai trò hợp lệ là `"user"` hoặc `"assistant"` (bỏ qua các tin nhắn hệ thống hoặc lỗi tạm thời).
 * - Sử dụng chiến lược phân tách mốc thời gian (`baseTime + index`) để đảm bảo thứ tự thời gian (`createdAt`)
 *   luôn chuẩn xác và ổn định khi truy vấn lại, ngay cả khi nhiều tin nhắn được sinh ra trong cùng 1 mili-giây.
 * - Áp dụng `upsert` theo `message.id` để đảm bảo tính idempotent, tránh lỗi trùng khóa nếu client gửi lại tin nhắn.
 *
 * @param scope - Đối tượng chứa `boardId` và `userId`.
 * @param messages - Mảng các tin nhắn `UIMessage` phát sinh cần lưu.
 * @returns Promise giải quyết khi giao dịch lưu tin nhắn hoàn tất thành công.
 *
 * @throws {Error} Nếu giao dịch Prisma bị rollback hoặc lỗi kết nối cơ sở dữ liệu.
 */
export const saveAssistantMessages = async (
  { boardId, userId }: HistoryScope,
  messages: UIMessage[],
): Promise<void> => {
  const baseTime = Date.now();

  await db.$transaction(
    messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message, index) => {
        const data = {
          role: message.role,
          content: extractText(message),
          parts: message.parts as unknown as Prisma.InputJsonValue,
        };

        return db.boardAiChat.upsert({
          where: { id: message.id },
          // Phân tách timestamp để đảm bảo thứ tự hiển thị luôn ổn định trong cùng một lượt trao đổi.
          create: { id: message.id, boardId, userId, createdAt: new Date(baseTime + index), ...data },
          update: data,
        });
      }),
  );
};

/**
 * Xóa sạch toàn bộ lịch sử trò chuyện của một người dùng trên bảng làm việc chỉ định.
 *
 * @remarks
 * Thường được gọi khi người dùng bấm nút "Xóa lịch sử chat" trên giao diện Trợ lý AI
 * để làm mới ngữ cảnh trò chuyện.
 *
 * @param scope - Đối tượng chứa `boardId` và `userId` cần xóa lịch sử.
 * @returns Promise hoàn tất khi toàn bộ các bản ghi `BoardAiChat` phù hợp đã bị xóa.
 *
 * @throws {Error} Nếu xảy ra lỗi truy vấn cơ sở dữ liệu với Prisma.
 */
export const clearAssistantHistory = async ({ boardId, userId }: HistoryScope): Promise<void> => {
  await db.boardAiChat.deleteMany({
    where: { boardId, userId },
  });
};
