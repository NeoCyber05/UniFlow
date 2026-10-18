import { z } from "zod";

import { CourseCode, CourseColor, CourseCredits, CourseName } from "../create-course/schema";

export const UpdateCourse = z.object({
  id: z.string(),
  boardId: z.string(),
  name: CourseName.optional(),
  code: CourseCode.optional(),
  credits: CourseCredits.optional(),
  color: CourseColor.optional(),
});
