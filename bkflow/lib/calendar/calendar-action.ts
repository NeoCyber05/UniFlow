import type { ActionState } from "@/lib/create-safe-action";

/** Keep transport and validation failures on the same path that retains the calendar form. */
export const runCalendarAction = async <TInput, TOutput>(action: () => Promise<ActionState<TInput, TOutput>>): Promise<ActionState<TInput, TOutput>> => {
  try {
    const result = await action();
    if (result.fieldErrors && !result.error) {
      return { ...result, error: Object.values(result.fieldErrors).flat().find((value): value is string => typeof value === "string") ?? "Vui lòng kiểm tra thông tin đã nhập." };
    }
    return result;
  } catch {
    return { error: "Không lưu được lịch. Nội dung đang nhập được giữ lại; hãy thử lại." };
  }
};
