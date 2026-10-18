/** Thêm/bỏ đúng một query param của detail, giữ nguyên course/filter/view/date. */
export const withDetailParam = (search: string, param: string, id: string | null): string => {
  const params = new URLSearchParams(search);

  if (id) params.set(param, id);
  else params.delete(param);

  return params.toString();
};
