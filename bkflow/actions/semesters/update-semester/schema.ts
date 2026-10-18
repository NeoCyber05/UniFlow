import { z } from "zod";
import { parseSemesterCode, getSemesterDefaultDates } from "@/lib/semesters";

export const UpdateSemester = z
  .object({
    id: z.string(),
    title: z.string().min(1, { message: "Vui lòng nhập tên học kỳ." }),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .transform((data) => {
    let { startDate, endDate } = data;
    const parsed = parseSemesterCode(data.title);

    if (parsed && (!startDate || !endDate)) {
      const defaults = getSemesterDefaultDates(parsed.year, parsed.term);
      startDate = startDate || defaults.startDate;
      endDate = endDate || defaults.endDate;
    }

    return {
      id: data.id,
      title: data.title.trim(),
      startDate: startDate!,
      endDate: endDate!,
    };
  })
  .refine((data) => data.startDate && data.endDate, {
    message: "Vui lòng chọn ngày bắt đầu và kết thúc.",
    path: ["startDate"],
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "Ngày kết thúc phải sau ngày bắt đầu.",
    path: ["endDate"],
  });
