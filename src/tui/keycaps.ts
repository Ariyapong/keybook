const GLYPHS = new Set(["⌘", "⌥", "⌃", "⇧", "⇪", "⏎", "⎋", "⌫", "⇥", "␣", "↑", "↓", "←", "→"]);

function parseSegment(seg: string): string[] {
  const tokens: string[] = [];
  let buf = "";
  for (const ch of seg) {
    if (GLYPHS.has(ch)) {
      if (buf) {
        tokens.push(buf);
        buf = "";
      }
      tokens.push(ch);
    } else if (ch === " ") {
      if (buf) {
        tokens.push(buf);
        buf = "";
      }
    } else {
      buf += ch;
    }
  }
  if (buf) tokens.push(buf);
  return tokens.length ? tokens : [seg];
}

/** Parse a keys string into a chord sequence of token groups. Never throws. */
export function parseKeys(input: string): string[][] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseSegment);
}
