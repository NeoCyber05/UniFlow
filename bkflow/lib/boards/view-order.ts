/**
 * Thứ tự tab từ localStorage. Id mặc định bị thiếu (tab mới) được nối cuối,
 * trừ id trong `prependIfMissing` được đưa lên đầu.
 */
export const resolveViewOrder = <T extends string>(
  savedJson: string,
  defaults: readonly T[],
  prependIfMissing: readonly T[] = [],
): T[] => {
  let saved: T[] = [];

  try {
    const parsed: unknown = JSON.parse(savedJson);

    if (Array.isArray(parsed)) {
      saved = parsed.filter((id): id is T => defaults.includes(id as T));
    }
  } catch {
    // Fallback về mặc định
  }

  if (saved.length === 0) {
    return [...defaults];
  }

  const unique = Array.from(new Set(saved));
  const missing = defaults.filter((id) => !unique.includes(id));

  return [
    ...missing.filter((id) => prependIfMissing.includes(id)),
    ...unique,
    ...missing.filter((id) => !prependIfMissing.includes(id)),
  ];
};
