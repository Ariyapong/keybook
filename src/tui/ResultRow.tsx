import { Box, Text } from "ink";
import type { Entry } from "../data/types";

export function ResultRow({ entry, selected }: { entry: Entry; selected: boolean }) {
  const right = entry.keys ?? "recipe";
  return (
    <Box>
      <Text color={selected ? "cyan" : undefined} inverse={selected}>
        {selected ? "▸ " : "  "}
        {entry.app} · {entry.action}
      </Text>
      <Text color="gray"> {right}</Text>
    </Box>
  );
}
