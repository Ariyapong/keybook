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
  // wrap="truncate-end" keeps the hint on one line even if its rendered cell
  // width exceeds the terminal (wide-glyph keycaps like ⌘⌥⌃⇧⏎⎋⌫ have ambiguous
  // East-Asian widths that some terminals render as 2 cells). A wrapped hint
  // pushes the frame past the terminal height and Ink's in-place redraw
  // breaks — every keystroke then stacks a stale copy in scrollback.
  return (
    <Box marginTop={1} justifyContent="space-between">
      <Text color="gray" wrap="truncate-end">
        ↑↓ move ⏎ copy ⌃O add ⎋ quit ⌥⌫/⌃W del ⌃U clear ({resultCount})
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
