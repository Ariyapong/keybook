import { Fzf, extendedMatch } from "fzf";
import type { Entry } from "./data/types";

function haystack(e: Entry): string {
  return [e.action, (e.tags ?? []).join(" "), e.app, e.keys ?? "", e.notes ?? ""]
    .filter(Boolean)
    .join("  ");
}

/** Pure fuzzy search. Empty query → all entries in stable browse order. */
export function search<T extends Entry>(entries: T[], query: string): T[] {
  const q = query.trim();
  if (!q) {
    return [...entries].sort(
      (a, b) => a.app.localeCompare(b.app) || a.action.localeCompare(b.action),
    );
  }
  // Pin Fzf's element type to Entry (haystack reads only Entry fields); the
  // matched items are the original T objects, so restoring T on return is sound.
  const fzf = new Fzf(entries as Entry[], { selector: haystack, match: extendedMatch });
  return fzf.find(q).map((r) => r.item as T);
}
