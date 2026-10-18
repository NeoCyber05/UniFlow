import { z } from "zod";

export const SELECTION_TASKS = {
  explain: { label: "Giải thích", instruction: "Giải thích đoạn được chọn bằng tiếng Việt dễ hiểu. Giữ nguyên dữ kiện; nói rõ khi thiếu thông tin." },
  shorten: { label: "Rút gọn", instruction: "Rút gọn đoạn được chọn, giữ ngôn ngữ, ý chính, mọi dữ kiện và ràng buộc." },
  improve: { label: "Sửa câu", instruction: "Sửa chính tả, ngữ pháp và cách diễn đạt của đoạn được chọn; giữ ngôn ngữ, ý nghĩa và dữ kiện." },
  checklist: { label: "Tạo checklist", instruction: "Chuyển đoạn được chọn thành checklist Markdown, mỗi mục bắt đầu bằng '- [ ] '. Không thêm yêu cầu hoặc dữ kiện mới." },
} as const;

export type SelectionTask = keyof typeof SELECTION_TASKS;

const SelectionInput = z.object({
  task: z.enum(["explain", "shorten", "improve", "checklist"]),
  text: z.string().trim().min(1).max(8000),
});

export const GenerateAiSelection = z.union([
  SelectionInput.extend({ boardId: z.string().min(1), cardId: z.string().min(1) }),
  SelectionInput.extend({ pageId: z.string().min(1) }),
]);
