import { basename } from "node:path";
import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { AddResult, EntryInput } from "../data/types";
import { FormFields } from "./FormFields";
import { ReviewScreen } from "./ReviewScreen";
import {
  type EntryType,
  draftToEntryInput,
  flushStep,
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
  resolveTarget?: (app: string) => { file: string; created: boolean };
  initial?: import("./useAddForm").Draft;
  lockedApp?: string;
  title?: string;
}

export function AddEntryForm({
  apps,
  existingTags,
  onSubmit,
  onComplete,
  onCancel,
  resolveTarget,
  initial,
  lockedApp,
  title,
}: AddEntryFormProps) {
  // Start synced to the highlighted choice (appIndex 0) so the draft is in sync
  // even if the user advances past field 0 without pressing ↑/↓.
  const { draft, update, setDraft } = useAddForm(initial ?? { app: apps[0] ?? "" });
  const [focused, setFocused] = useState(lockedApp ? 1 : 0);
  const [appIndex, setAppIndex] = useState(0);
  const [screen, setScreen] = useState<"form" | "review">("form");
  const [hint, setHint] = useState("");
  const [writeError, setWriteError] = useState("");

  const appChoices = [...apps, "Create new app…"];

  // Keep the draft's app in sync with the highlighted choice so there's never
  // any divergence between appIndex and what gets validated/submitted.
  function commitAppSelection(index: number) {
    if (index === apps.length) update({ creatingApp: true });
    else update({ creatingApp: false, app: apps[index] ?? "" });
  }

  function goReview() {
    const d = flushStep(draft);
    const v = validateDraft(d);
    if (v) {
      setHint(v);
      return;
    }
    setHint("");
    setDraft(d);
    setScreen("review");
  }

  const review = flushStep(draft);
  const target = resolveTarget?.(resolvedApp(review));
  const targetPath = target
    ? `${basename(target.file)}${target.created ? " (new)" : ""}`
    : `${resolvedApp(review)} file`;

  useInput((input, key) => {
    if (screen === "review") {
      if (key.escape) return onCancel();
      if (input === "e") return setScreen("form");
      if (key.return) {
        const result = onSubmit(resolvedApp(review), draftToEntryInput(review));
        if (result.ok) onComplete?.(result);
        else setWriteError(result.lines.join("; "));
      }
      return;
    }

    if (key.escape) return onCancel();
    if (key.ctrl && input === "n") return setFocused((f) => Math.min(f + 1, LAST_FIELD));
    if (key.ctrl && input === "p") return setFocused((f) => Math.max(f - 1, lockedApp ? 1 : 0));

    // Field 0: app selection. ↑/↓ move the highlight AND sync the draft so it
    // always tracks the highlighted choice (no appIndex/draft divergence).
    if (focused === 0) {
      if (key.upArrow) {
        const next = Math.max(appIndex - 1, 0);
        setAppIndex(next);
        return commitAppSelection(next);
      }
      if (key.downArrow) {
        const next = Math.min(appIndex + 1, appChoices.length - 1);
        setAppIndex(next);
        return commitAppSelection(next);
      }
      // When "Create new app…" is highlighted, type the name here, then advance
      // with ⏎ (⌃N/⌃P are handled by the navigation block above).
      if (draft.creatingApp) {
        if (key.return) return setFocused(1);
        if (key.backspace || key.delete) return update({ newApp: draft.newApp.slice(0, -1) });
        if (input && !key.ctrl && !key.meta) return update({ newApp: draft.newApp + input });
        return;
      }
      if (key.return) return setFocused(1);
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
      // A chooser field: ⏎ confirms the selection and advances to Action (like
      // the App field), rather than jumping to review — keeps ⏎ consistent and
      // never strands the user on a field that ignores typing.
      if (key.return) return setFocused(2);
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

  // ⏎ advances on the chooser fields (App, Type) and reviews on the text fields;
  // recipe steps use ⏎ to append a line. Label it accurately per field.
  const enterHint =
    focused <= 1 ? "next" : focused === 3 && draft.type === "recipe" ? "add step" : "review";

  if (screen === "review") {
    return (
      <ReviewScreen
        app={resolvedApp(review)}
        entry={draftToEntryInput(review)}
        targetPath={targetPath}
        error={writeError}
      />
    );
  }

  return (
    <Box flexDirection="column">
      <Text color="cyan">{title ?? "keybook add"}</Text>
      <Box marginTop={1}>
        <FormFields
          draft={draft}
          apps={apps}
          appIndex={appIndex}
          focused={focused}
          existingTags={existingTags}
          lockedApp={lockedApp}
        />
      </Box>
      <Box marginTop={1} flexDirection="column">
        {hint ? <Text color="red">{hint}</Text> : null}
        <Text color="gray">{`⌃N next · ⌃P prev · ⏎ ${enterHint} · esc cancel`}</Text>
      </Box>
    </Box>
  );
}
