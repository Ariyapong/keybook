import { Box, Text } from "ink";
import type { Entry } from "../data/types";

export function ResultRow({ entry, selected }: { entry: Entry; selected: boolean }) {
  const right = entry.keys ?? "recipe";
  // wrap="truncate-end" forces this row to stay on one line even if the
  // entry's app+action text is wider than the column. Without it, long
  // entries wrap to 2 lines, the rendered frame exceeds the terminal
  // height, and Ink's in-place redraw leaves stale lines on every
  // keystroke (see layout.ts comments).
  return (
    <Box>
      <Text wrap="truncate-end">
        <Text color={selected ? "cyan" : undefined} inverse={selected}>
          {selected ? "▸ " : "  "}
          {entry.app} · {entry.action}
        </Text>
        <Text color="gray"> {right}</Text>
      </Text>
    </Box>
  );
}
