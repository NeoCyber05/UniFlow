import { z } from "zod";

import { COURSE_COLOR_KEYS } from "@/lib/courses/course-colors";

export const CourseName = z.string("Vui lòng nhập tên môn.")
  .trim()
  .min(1, { message: "Vui lòng nhập tên môn." })
  .max(80, { message: "Tên môn tối đa 80 ký tự." });

export const CourseCode = z.string().trim().max(20, { message: "Mã HP tối đa 20 ký tự." }).nullable();

export const CourseCredits = z.number().int().min(0).max(10, { message: "Tín chỉ từ 0 đến 10." }).nullable();

export const CourseColor = z.enum(COURSE_COLOR_KEYS);

export const CreateCourse = z.object({
  boardId: z.string(),
  name: CourseName,
  code: CourseCode.optional(),
  credits: CourseCredits.optional(),
  color: CourseColor,
});
