/**
 * Drop the run of trailing whitespace, then the run of trailing non-whitespace.
 * Mirrors readline's `unix-word-rubout` / `backward-kill-word` behavior so a
 * single press eats both the spaces and the word immediately before them.
 */
export function deleteWordBack(query: string): string {
  const trimmed = query.replace(/\s+$/, "");
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) return "";
  return trimmed.slice(0, lastSpace + 1);
}
