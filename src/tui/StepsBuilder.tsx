import { Box, Text } from "ink";

export function StepsBuilder({
  steps,
  line,
  active,
}: { steps: string[]; line: string; active: boolean }) {
  return (
    <Box flexDirection="column">
      {steps.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: steps are an ordered append-only list; duplicates are allowed so the value is not a unique key
        <Text key={i}>
          {i + 1}. {s}
        </Text>
      ))}
      <Box>
        <Text color={active ? "cyan" : "gray"}>{steps.length + 1}. </Text>
        <Text>{line}</Text>
        {active ? <Text inverse> </Text> : null}
      </Box>
      {steps.length === 0 ? (
        <Text color="gray">⏎ adds a step · ⌫ on an empty line removes the last</Text>
      ) : null}
    </Box>
  );
}
