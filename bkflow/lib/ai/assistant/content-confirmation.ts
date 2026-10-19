/** Emptying existing content, or replacing over half of a substantial note, needs an explicit preview. */
export const requiresContentConfirmation = (before: string | null, after: string) => {
  const old = before ?? "";
  if (!old.trim() || old === after) return false;
  if (!after.trim()) return true;
  if (old.length < 200) return false;
  let start = 0; let end = 0;
  while (start < Math.min(old.length, after.length) && old[start] === after[start]) start++;
  while (end < Math.min(old.length, after.length) - start && old[old.length - end - 1] === after[after.length - end - 1]) end++;
  return old.length - start - end > old.length / 2;
};
