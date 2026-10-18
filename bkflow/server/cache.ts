// SPA has no server render cache; clients refetch via TanStack Query after mutations (web/lib/call-action.ts).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const revalidatePath = (_path: string, _type?: "page" | "layout") => {};
