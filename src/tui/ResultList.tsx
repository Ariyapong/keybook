import { Box, Text } from "ink";
import type { Entry } from "../data/types";
import { ResultRow } from "./ResultRow";

export function ResultList({
  results,
  selected,
  query,
  height = 12,
}: {
  results: Entry[];
  selected: number;
  query: string;
  height?: number;
}) {
  if (results.length === 0) {
    return (
      <Box width="50%" justifyContent="center">
        <Text color="gray">No matches for "{query}"</Text>
      </Box>
    );
  }
  const start = Math.max(0, Math.min(selected - Math.floor(height / 2), results.length - height));
  const visible = results.slice(Math.max(0, start), Math.max(0, start) + height);
  return (
    <Box flexDirection="column" width="50%">
      {visible.map((e, i) => (
        <ResultRow
          key={`${e.app}:${e.action}`}
          entry={e}
          selected={Math.max(0, start) + i === selected}
        />
      ))}
    </Box>
  );
}
