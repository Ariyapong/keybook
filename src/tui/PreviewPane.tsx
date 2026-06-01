import { Box, Text } from "ink";
import type { Entry } from "../data/types";
import { parseKeys } from "./keycaps";

function KeyCaps({ value }: { value: string }) {
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

export function PreviewPane({ entry, width = "50%" }: { entry?: Entry; width?: number | string }) {
  if (!entry) return null;
  return (
    <Box flexDirection="column" width={width} paddingLeft={2}>
      <Text color="cyan">{entry.app}</Text>
      <Text bold>{entry.action}</Text>
      <Box marginTop={1} flexDirection="column">
        {entry.keys ? <KeyCaps value={entry.keys} /> : null}
        {entry.steps?.map((s, i) => (
          <Text key={s}>
            {i + 1}. {s}
          </Text>
        ))}
        {entry.command ? <Text color="green">$ {entry.command}</Text> : null}
      </Box>
      {entry.tags?.length ? <Text color="gray">tags: {entry.tags.join(", ")}</Text> : null}
      {entry.notes ? <Text color="gray">{entry.notes}</Text> : null}
    </Box>
  );
}
