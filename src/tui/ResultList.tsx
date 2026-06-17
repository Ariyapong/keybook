import { Box, Text } from "ink";
import { favKey } from "../data/favorites";
import type { Entry } from "../data/types";
import { ResultRow } from "./ResultRow";

export function ResultList({
  results,
  selected,
  query,
  height = 12,
  width = "50%",
  favorites,
  emptyMessage,
}: {
  results: Entry[];
  selected: number;
  query: string;
  height?: number;
  width?: number | string;
  favorites?: Set<string>;
  emptyMessage?: string;
}) {
  if (results.length === 0) {
    return (
      <Box width={width} justifyContent="center">
        <Text color="gray">{emptyMessage ?? `No matches for "${query}"`}</Text>
      </Box>
    );
  }
  const start = Math.max(0, Math.min(selected - Math.floor(height / 2), results.length - height));
  const visible = results.slice(Math.max(0, start), Math.max(0, start) + height);
  return (
    <Box flexDirection="column" width={width}>
      {visible.map((e, i) => (
        <ResultRow
          key={`${e.app}:${e.action}`}
          entry={e}
          selected={Math.max(0, start) + i === selected}
          favorite={favorites?.has(favKey(e.app, e.action)) ?? false}
        />
      ))}
    </Box>
  );
}
