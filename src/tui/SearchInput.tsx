import { Box, Text } from "ink";

export function SearchInput({ query }: { query: string }) {
  return (
    <Box>
      <Text color="cyan">search: </Text>
      <Text>{query}</Text>
      <Text inverse> </Text>
    </Box>
  );
}
