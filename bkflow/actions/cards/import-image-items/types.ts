import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";

import { ImportImageItems } from "./schema";

export type InputType = z.infer<typeof ImportImageItems>;
export type ReturnType = ActionState<InputType, {
  /** Số thẻ mới; thẻ đã nhập lần trước (cùng id) không tính */
  created: number;
  total: number;
}>;
