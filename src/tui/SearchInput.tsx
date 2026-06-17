import { Box, Text } from "ink";

export function SearchInput({ query, filterLabel }: { query: string; filterLabel?: string }) {
  // justifyContent="space-between" pushes the filter label to the right edge
  // while the query+cursor stay on the left. Both children use truncate-end so
  // the line never wraps to a second row (which would break Ink's in-place
  // redraw — see ResultRow/Footer/layout.ts).
  return (
    <Box justifyContent="space-between">
      <Text wrap="truncate-end">
        <Text color="cyan">search: </Text>
        <Text>{query}</Text>
        <Text inverse> </Text>
      </Text>
      {filterLabel ? (
        <Text color="gray" wrap="truncate-end">
          {filterLabel}
        </Text>
      ) : null}
    </Box>
  );
}
