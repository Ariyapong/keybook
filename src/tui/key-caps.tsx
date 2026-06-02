import { Box, Text } from "ink";
import { parseKeys } from "./keycaps";

export function KeyCaps({ value }: { value: string }) {
  const chords = parseKeys(value);
  return (
    <Box>
      {chords.map((seg, si) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable; tokens can repeat (e.g. ⌃X⌃E) so the value is not a unique key
        <Box key={si}>
          {si > 0 ? <Text> , </Text> : null}
          {seg.map((tok, ti) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: see above — repeated tokens make the value non-unique
            <Box key={ti} marginRight={1} borderStyle="round" paddingX={1}>
              <Text bold>{tok}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
