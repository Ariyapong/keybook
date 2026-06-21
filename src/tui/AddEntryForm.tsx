import { basename } from "node:path";
import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import type { AddResult, EntryInput } from "../data/types";
import { FormFields } from "./FormFields";
import { ReviewScreen } from "./ReviewScreen";
import {
  type EntryType,
  deleteStep,
  draftToEntryInput,
  flushStep,
  moveStep,
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
  initialFocus?: number;
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
  initialFocus,
  title,
}: AddEntryFormProps) {
  // Start synced to the highlighted choice (appIndex 0) so the draft is in sync
  // even if the user advances past field 0 without pressing ↑/↓.
  const { draft, update, setDraft } = useAddForm(initial ?? { app: apps[0] ?? "" });
  const [focused, setFocused] = useState(initialFocus ?? 0);
  const [stepCursor, setStepCursor] = useState(initial?.steps?.length ?? 0);
  const [grabbed, setGrabbed] = useState(false);
  const [appIndex, setAppIndex] = useState(() => {
    const i = apps.indexOf(initial?.app ?? apps[0] ?? "");
    return i >= 0 ? i : 0;
  });
  const [screen, setScreen] = useState<"form" | "review">("form");
  const [hint, setHint] = useState("");
  const [writeError, setWriteError] = useState("");

  useEffect(() => {
    if (!(focused === 3 && draft.type === "recipe")) {
      setGrabbed(false);
      setStepCursor(draft.steps.length);
    }
  }, [focused, draft.type, draft.steps.length]);

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

    if (grabbed && key.escape) return setGrabbed(false);
    if (key.escape) return onCancel();
    if (key.ctrl && input === "n") return setFocused((f) => Math.min(f + 1, LAST_FIELD));
    if (key.ctrl && input === "p") return setFocused((f) => Math.max(f - 1, 0));

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

    // Field 3 recipe: steps builder with grab-and-move reorder.
    if (focused === 3 && draft.type === "recipe") {
      const steps = draft.steps;
      const onAppendLine = stepCursor >= steps.length;

      if (grabbed) {
        if (key.upArrow && stepCursor > 0) {
          update({ steps: moveStep(steps, stepCursor, stepCursor - 1) });
          return setStepCursor(stepCursor - 1);
        }
        if (key.downArrow && stepCursor < steps.length - 1) {
          update({ steps: moveStep(steps, stepCursor, stepCursor + 1) });
          return setStepCursor(stepCursor + 1);
        }
        if (key.return || input === " " || key.escape) return setGrabbed(false);
        return; // swallow everything else while grabbed
      }

      if (onAppendLine) {
        if (key.return) {
          if (draft.stepLine.trim()) {
            update({ steps: [...steps, draft.stepLine.trim()], stepLine: "" });
            setStepCursor(steps.length + 1); // stay on the NEW append line
          }
          return;
        }
        if (key.backspace || key.delete) {
          if (draft.stepLine) return update({ stepLine: draft.stepLine.slice(0, -1) });
          if (steps.length) return setStepCursor(steps.length - 1); // select last (no delete)
          return;
        }
        if (key.upArrow) {
          if (steps.length) return setStepCursor(steps.length - 1);
          return;
        }
        if (input && !key.ctrl && !key.meta) return update({ stepLine: draft.stepLine + input });
        return;
      }

      // cursor on an existing step
      if (key.upArrow) return setStepCursor(Math.max(0, stepCursor - 1));
      if (key.downArrow) return setStepCursor(stepCursor + 1); // steps.length -> append line
      if (key.return || input === " ") return setGrabbed(true); // pick it up
      if (key.backspace || key.delete) {
        const next = deleteStep(steps, stepCursor);
        update({ steps: next });
        return setStepCursor(Math.min(stepCursor, next.length));
      }
      return; // printable ignored on a step (mid-string edit out of scope)
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
          stepCursor={stepCursor}
          grabbed={grabbed}
        />
      </Box>
      <Box marginTop={1} flexDirection="column">
        {hint ? <Text color="red">{hint}</Text> : null}
        <Text color="gray">{`⌃N next · ⌃P prev · ⏎ ${enterHint} · esc cancel`}</Text>
      </Box>
    </Box>
  );
}
