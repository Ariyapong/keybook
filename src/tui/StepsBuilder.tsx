import { Box, Text } from "ink";

export function StepsBuilder({
  steps,
  line,
  active,
  cursor,
  grabbed = false,
}: {
  steps: string[];
  line: string;
  active: boolean;
  cursor?: number;
  grabbed?: boolean;
}) {
  const cur = cursor ?? steps.length; // default: the append line
  const onAppendLine = cur >= steps.length;
  const hint = grabbed
    ? "↑↓ move · Space/⏎ drop"
    : steps.length === 0
      ? "⏎ adds a step · ⌫ on an empty line removes the last"
      : onAppendLine
        ? "⏎ adds a step · ↑ select a step to reorder"
        : "↑↓ select · Space grab · ⌫ delete";

  return (
    <Box flexDirection="column">
      {steps.map((s, i) => {
        const marker = active && cur === i ? (grabbed ? "⇅ " : "> ") : "  ";
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: steps are an ordered list; duplicates allowed so value is not a unique key
          <Text key={i}>
            {marker}
            {i + 1}. {s}
          </Text>
        );
      })}
      <Box>
        <Text color={active && onAppendLine ? "cyan" : "gray"}>
          {"  "}
          {steps.length + 1}.{" "}
        </Text>
        <Text>{line}</Text>
        {active && onAppendLine ? <Text inverse> </Text> : null}
      </Box>
      {active ? <Text color="gray">{hint}</Text> : null}
    </Box>
  );
}
