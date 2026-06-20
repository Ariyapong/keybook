import { Box, Text } from "ink";
import { normalizeKeys } from "../data/keys";
import { StepsBuilder } from "./StepsBuilder";
import type { Draft } from "./useAddForm";

const TYPES: Array<Draft["type"]> = ["shortcut", "command", "recipe"];

function Field({ label, value, focused }: { label: string; value: string; focused: boolean }) {
  return (
    <Box>
      <Text color={focused ? "cyan" : "gray"}>{label.padEnd(8)}</Text>
      <Text>{value}</Text>
      {focused ? <Text inverse> </Text> : null}
    </Box>
  );
}

export function FormFields({
  draft,
  apps,
  appIndex,
  focused,
  existingTags,
  stepCursor,
  grabbed,
}: {
  draft: Draft;
  apps: string[];
  appIndex: number;
  focused: number;
  existingTags?: string[];
  stepCursor?: number;
  grabbed?: boolean;
}) {
  const appChoices = [...apps, "Create new app…"];
  return (
    <Box flexDirection="column">
      {/* 0: app */}
      <Box>
        <Text color={focused === 0 ? "cyan" : "gray"}>{"App".padEnd(8)}</Text>
        {draft.creatingApp ? (
          <>
            <Text>{draft.newApp}</Text>
            {focused === 0 ? <Text inverse> </Text> : null}
          </>
        ) : (
          <Text>
            {appChoices[appIndex] ?? "—"}
            {focused === 0 ? "  (↑/↓)" : ""}
          </Text>
        )}
      </Box>
      {/* 1: type */}
      <Box>
        <Text color={focused === 1 ? "cyan" : "gray"}>{"Type".padEnd(8)}</Text>
        <Text>{TYPES.map((t) => (t === draft.type ? `(•) ${t}` : `( ) ${t}`)).join("  ")}</Text>
      </Box>
      {/* 2: action */}
      <Field label="Action" value={draft.action} focused={focused === 2} />
      {/* 3: primary */}
      {draft.type === "shortcut" ? (
        <Box>
          <Text color={focused === 3 ? "cyan" : "gray"}>{"Keys".padEnd(8)}</Text>
          <Text>{draft.keys}</Text>
          {focused === 3 ? <Text inverse> </Text> : null}
          {draft.keys.trim() ? (
            <Text color="gray">
              {"  →  "}
              {normalizeKeys(draft.keys)}
            </Text>
          ) : null}
        </Box>
      ) : draft.type === "command" ? (
        <Field label="Command" value={`$ ${draft.command}`} focused={focused === 3} />
      ) : (
        <Box flexDirection="column">
          <Text color={focused === 3 ? "cyan" : "gray"}>Steps</Text>
          <StepsBuilder
            steps={draft.steps}
            line={draft.stepLine}
            active={focused === 3}
            cursor={stepCursor}
            grabbed={grabbed}
          />
        </Box>
      )}
      {/* 4: tags */}
      <Field label="Tags" value={draft.tags} focused={focused === 4} />
      {focused === 4 && existingTags && existingTags.length > 0 ? (
        <Text color="gray">{`${"".padEnd(8)}e.g. ${existingTags.slice(0, 6).join(", ")}`}</Text>
      ) : null}
      {/* 5: notes */}
      <Field label="Notes" value={draft.notes} focused={focused === 5} />
    </Box>
  );
}
