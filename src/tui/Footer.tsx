import { Box, Text } from "ink";

export function Footer({
  flash,
  errorCount,
  resultCount,
}: {
  flash: string;
  errorCount: number;
  resultCount: number;
}) {
  return (
    <Box marginTop={1} justifyContent="space-between">
      <Text color="gray">↑↓ move ⏎ copy ⌃O add ⎋ quit ⌥⌫/⌃W del ⌃U clear ({resultCount})</Text>
      {flash ? (
        <Text color="green">{flash}</Text>
      ) : errorCount > 0 ? (
        <Text color="yellow">⚠ {errorCount} skipped — run `keybook check`</Text>
      ) : (
        <Text> </Text>
      )}
    </Box>
  );
}
