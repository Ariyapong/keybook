import { Box, Text } from "ink";

export function Footer({
  flash,
  errorCount,
  resultCount,
  confirm,
}: {
  flash: string;
  errorCount: number;
  resultCount: number;
  confirm?: string;
}) {
  // wrap="truncate-end" keeps the line within the frame even when wide-glyph
  // keycaps (⌘⌥⌃⇧⏎⎋⌫) render as 2 cells. A wrapped line overflows the height
  // and Ink's in-place redraw breaks (commit 66200d9). The confirm question
  // truncates on the left; the y / n lives in the fixed right cell so it is
  // always visible.
  if (confirm) {
    return (
      <Box marginTop={1} justifyContent="space-between">
        <Text color="yellow" wrap="truncate-end">
          {confirm}
        </Text>
        <Text color="yellow" bold>
          {"  y / n"}
        </Text>
      </Box>
    );
  }
  return (
    <Box marginTop={1} justifyContent="space-between">
      <Text color="gray" wrap="truncate-end">
        ↑↓ move ⏎ copy ⌃O add ⌃E edit ⌃X del ⎋ quit ⌃U clear ({resultCount})
      </Text>
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
