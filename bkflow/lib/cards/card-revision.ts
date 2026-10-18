/** Chuẩn hóa Card.updatedAt (Date hoặc chuỗi) thành ISO dùng làm expectedUpdatedAt. */
export const toCardRevision = (value: Date | string | null | undefined): string | undefined => {
  if (!value) return undefined;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
};
