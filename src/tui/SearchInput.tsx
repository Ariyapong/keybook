import { Box, Text } from "ink";

export function SearchInput({ query }: { query: string }) {
  // Same defense as ResultRow / Footer: never let the search line wrap to a
  // second row, which would push the frame past the terminal height and
  // break Ink's in-place redraw.
  return (
    <Box>
      <Text wrap="truncate-end">
        <Text color="cyan">search: </Text>
        <Text>{query}</Text>
        <Text inverse> </Text>
      </Text>
    </Box>
  );
}
