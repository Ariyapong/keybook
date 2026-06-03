import { Box, Text } from "ink";
import type { EntryInput } from "../data/types";
import { KeyCaps } from "./key-caps";

export function ReviewScreen({
  app,
  entry,
  targetPath,
  error,
}: {
  app: string;
  entry: EntryInput;
  targetPath: string;
  error: string;
}) {
  return (
    <Box flexDirection="column">
      <Text color="cyan">Review — {app}</Text>
      <Text bold>{entry.action}</Text>
      <Box marginTop={1} flexDirection="column">
        {entry.keys ? <KeyCaps value={entry.keys} /> : null}
        {entry.steps?.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: ordered append-only step list
          <Text key={i}>
            {i + 1}. {s}
          </Text>
        ))}
        {entry.command ? <Text color="green">$ {entry.command}</Text> : null}
      </Box>
      {entry.tags?.length ? <Text color="gray">tags: {entry.tags.join(", ")}</Text> : null}
      {entry.notes ? <Text color="gray">{entry.notes}</Text> : null}
      <Text color="gray">→ {targetPath}</Text>
      {error ? <Text color="red">{error}</Text> : null}
      <Box marginTop={1}>
        <Text color="gray">⏎ save · e edit · esc cancel</Text>
      </Box>
    </Box>
  );
}
