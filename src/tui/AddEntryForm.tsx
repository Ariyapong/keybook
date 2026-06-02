import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { AddResult, EntryInput } from "../data/types";
import { FormFields } from "./FormFields";
import { ReviewScreen } from "./ReviewScreen";
import {
  type EntryType,
  draftToEntryInput,
  resolvedApp,
  useAddForm,
  validateDraft,
} from "./useAddForm";

const TYPES: EntryType[] = ["shortcut", "command", "recipe"];
const LAST_FIELD = 5;

export interface AddEntryFormProps {
  apps: string[];
  existingTags?: string[];
  onSubmit: (app: string, entry: EntryInput) => AddResult;
  onComplete?: (result: AddResult) => void;
  onCancel: () => void;
}

export function AddEntryForm({ apps, onSubmit, onComplete, onCancel }: AddEntryFormProps) {
  const { draft, update } = useAddForm();
  const [focused, setFocused] = useState(0);
  const [appIndex, setAppIndex] = useState(0);
  const [screen, setScreen] = useState<"form" | "review">("form");
  const [hint, setHint] = useState("");
  const [writeError, setWriteError] = useState("");

  const appChoices = [...apps, "Create new app…"];

  function commitAppSelection() {
    if (appIndex === apps.length) update({ creatingApp: true, app: "" });
    else update({ creatingApp: false, app: apps[appIndex] ?? "" });
  }

  function goReview() {
    commitAppSelection();
    const v = validateDraft({
      ...draft,
      app: appIndex < apps.length ? (apps[appIndex] ?? "") : draft.app,
      creatingApp: appIndex === apps.length,
    });
    if (v) {
      setHint(v);
      return;
    }
    setHint("");
    setScreen("review");
  }

  useInput((input, key) => {
    if (screen === "review") {
      if (key.escape) return onCancel();
      if (input === "e") return setScreen("form");
      if (key.return) {
        const result = onSubmit(resolvedApp(draft), draftToEntryInput(draft));
        if (result.ok) onComplete?.(result);
        else setWriteError(result.lines.join("; "));
      }
      return;
    }

    if (key.escape) return onCancel();
    if (key.ctrl && input === "n") return setFocused((f) => Math.min(f + 1, LAST_FIELD));
    if (key.ctrl && input === "p") return setFocused((f) => Math.max(f - 1, 0));

    // Field 0: app selection
    if (focused === 0 && !draft.creatingApp) {
      if (key.upArrow) return setAppIndex((i) => Math.max(i - 1, 0));
      if (key.downArrow) return setAppIndex((i) => Math.min(i + 1, appChoices.length - 1));
      if (key.return) {
        commitAppSelection();
        return setFocused(1);
      }
      return;
    }
    if (focused === 0 && draft.creatingApp) {
      if (key.return) return setFocused(1);
      if (key.backspace || key.delete) return update({ newApp: draft.newApp.slice(0, -1) });
      if (input && !key.ctrl && !key.meta) return update({ newApp: draft.newApp + input });
      return;
    }

    // Field 1: type toggle
    if (focused === 1) {
      if (key.leftArrow || key.rightArrow || input === " ") {
        const idx = TYPES.indexOf(draft.type);
        const next = key.leftArrow
          ? (idx + TYPES.length - 1) % TYPES.length
          : (idx + 1) % TYPES.length;
        return update({ type: TYPES[next] });
      }
      if (key.return) return goReview();
      return;
    }

    // Field 3 recipe: steps builder
    if (focused === 3 && draft.type === "recipe") {
      if (key.return) {
        if (draft.stepLine.trim())
          update({ steps: [...draft.steps, draft.stepLine.trim()], stepLine: "" });
        return;
      }
      if (key.backspace || key.delete) {
        if (draft.stepLine) return update({ stepLine: draft.stepLine.slice(0, -1) });
        return update({ steps: draft.steps.slice(0, -1) });
      }
      if (input && !key.ctrl && !key.meta) return update({ stepLine: draft.stepLine + input });
      return;
    }

    // Text fields: 2 action, 3 keys/command, 4 tags, 5 notes
    if (key.return) return goReview();
    const fieldKey =
      focused === 2
        ? "action"
        : focused === 3
          ? draft.type === "command"
            ? "command"
            : "keys"
          : focused === 4
            ? "tags"
            : "notes";
    if (key.backspace || key.delete)
      return update({ [fieldKey]: (draft[fieldKey] as string).slice(0, -1) });
    if (input && !key.ctrl && !key.meta)
      return update({ [fieldKey]: (draft[fieldKey] as string) + input });
  });

  if (screen === "review") {
    return (
      <ReviewScreen
        app={resolvedApp(draft)}
        entry={draftToEntryInput(draft)}
        targetPath={`${resolvedApp(draft)} file`}
        error={writeError}
      />
    );
  }

  return (
    <Box flexDirection="column">
      <Text color="cyan">keybook add</Text>
      <Box marginTop={1}>
        <FormFields draft={draft} apps={apps} appIndex={appIndex} focused={focused} />
      </Box>
      <Box marginTop={1}>
        <Text color={hint ? "red" : "gray"}>
          {hint || "⌃N next · ⌃P prev · ⏎ review · esc cancel"}
        </Text>
      </Box>
    </Box>
  );
}
