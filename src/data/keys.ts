const MODS: Record<string, string> = {
  cmd: "⌘",
  command: "⌘",
  "⌘": "⌘",
  opt: "⌥",
  option: "⌥",
  alt: "⌥",
  "⌥": "⌥",
  ctrl: "⌃",
  control: "⌃",
  "⌃": "⌃",
  shift: "⇧",
  "⇧": "⇧",
};

const NAMED: Record<string, string> = {
  return: "⏎",
  enter: "⏎",
  "⏎": "⏎",
  esc: "⎋",
  escape: "⎋",
  "⎋": "⎋",
  del: "⌫",
  delete: "⌫",
  backspace: "⌫",
  "⌫": "⌫",
  tab: "⇥",
  "⇥": "⇥",
  space: "␣",
  "␣": "␣",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  "↑": "↑",
  "↓": "↓",
  "←": "←",
  "→": "→",
};

const MOD_ORDER = ["⌃", "⌥", "⇧", "⌘"];

function normalizeSegment(seg: string): string {
  const trimmed = seg.trim();
  if (!trimmed) return "";
  const tokens = trimmed.split(/[\s+]+/).filter(Boolean);
  const mods = new Set<string>();
  const keys: string[] = [];
  for (const tok of tokens) {
    const low = tok.toLowerCase();
    if (MODS[low]) {
      mods.add(MODS[low]);
    } else if (NAMED[low]) {
      keys.push(NAMED[low]);
    } else {
      keys.push(tok.length === 1 ? tok.toUpperCase() : tok);
    }
  }
  const orderedMods = MOD_ORDER.filter((m) => mods.has(m));
  return orderedMods.join("") + keys.join("");
}

/** Normalize human key input into the canonical macOS glyph string. Never throws. */
export function normalizeKeys(input: string): string {
  return input
    .split(/\s*,\s*|\s+then\s+/i)
    .map(normalizeSegment)
    .filter(Boolean)
    .join(", ");
}
