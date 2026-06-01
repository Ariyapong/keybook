import { Fzf, extendedMatch } from "fzf";
import type { Entry } from "./data/types";

function haystack(e: Entry): string {
  return [e.action, (e.tags ?? []).join(" "), e.app, e.keys ?? "", e.notes ?? ""]
    .filter(Boolean)
    .join("  ");
}

/** Pure fuzzy search. Empty query → all entries in stable browse order. */
export function search(entries: Entry[], query: string): Entry[] {
  const q = query.trim();
  if (!q) {
    return [...entries].sort(
      (a, b) => a.app.localeCompare(b.app) || a.action.localeCompare(b.action),
    );
  }
  const fzf = new Fzf(entries, { selector: haystack, match: extendedMatch });
  return fzf.find(q).map((r) => r.item);
}
