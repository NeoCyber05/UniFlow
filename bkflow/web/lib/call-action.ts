import superjson from "superjson";

import type { ActionState } from "@/lib/create-safe-action";

// The parsed body may be undefined (e.g. deleteBoard calls Next redirect() server-side); callers treat falsy as "no result".
export const callAction =
  <TInput, TOutput>(key: string) =>
  async (input: TInput): Promise<ActionState<TInput, TOutput>> => {
    const res = await fetch(`/api/actions/${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: superjson.stringify(input),
    });
    if (res.status === 401) return { error: "Phiên đăng nhập đã hết hạn." };
    // TRANSPORT: the server may or may not have run the action (proxy/5xx); callers that create data retry with the same id.
    if (!res.ok) return { error: "Có lỗi xảy ra, thử lại sau.", errorCode: "TRANSPORT" };
    return superjson.parse(await res.text());
  };
