import { useState } from "react";
import { normalizeKeys } from "../data/keys";
import type { EntryInput } from "../data/types";

export type EntryType = "shortcut" | "command" | "recipe";

export interface Draft {
  app: string;
  newApp: string;
  creatingApp: boolean;
  type: EntryType;
  action: string;
  keys: string;
  command: string;
  steps: string[];
  stepLine: string;
  tags: string;
  notes: string;
}

export const emptyDraft: Draft = {
  app: "",
  newApp: "",
  creatingApp: false,
  type: "shortcut",
  action: "",
  keys: "",
  command: "",
  steps: [],
  stepLine: "",
  tags: "",
  notes: "",
};

export function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Move the step at `from` to position `to`, returning a NEW array. No-op if out of range or from===to. */
export function moveStep(steps: string[], from: number, to: number): string[] {
  if (from < 0 || from >= steps.length || to < 0 || to >= steps.length || from === to) {
    return steps;
  }
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return steps; // unreachable given the range guard; satisfies noUncheckedIndexedAccess
  next.splice(to, 0, moved);
  return next;
}

/** Remove the step at `i`, returning a NEW array. No-op if out of range. */
export function deleteStep(steps: string[], i: number): string[] {
  if (i < 0 || i >= steps.length) return steps;
  return steps.filter((_, idx) => idx !== i);
}

export function resolvedApp(d: Draft): string {
  return (d.creatingApp ? d.newApp : d.app).trim();
}

/**
 * Flush a typed-but-not-yet-appended recipe step (`stepLine`) into `steps`.
 * Returns `d` unchanged when `stepLine` is empty after trimming.
 */
export function flushStep(d: Draft): Draft {
  const line = d.stepLine.trim();
  if (!line) return d;
  return { ...d, steps: [...d.steps, line], stepLine: "" };
}

export function validateDraft(d: Draft): string | null {
  if (!resolvedApp(d)) return "App is required";
  if (!d.action.trim()) return "Action is required";
  const has =
    Boolean(normalizeKeys(d.keys).trim()) || Boolean(d.command.trim()) || d.steps.length > 0;
  if (!has) return "Add keys, a command, or at least one step";
  return null;
}

export function draftToEntryInput(d: Draft): EntryInput {
  const e: EntryInput = { action: d.action.trim() };
  const keys = normalizeKeys(d.keys).trim();
  if (keys) e.keys = keys;
  if (d.command.trim()) e.command = d.command.trim();
  if (d.steps.length) e.steps = d.steps;
  const tags = parseTags(d.tags);
  if (tags.length) e.tags = tags;
  if (d.notes.trim()) e.notes = d.notes.trim();
  return e;
}

/** Inverse of draftToEntryInput: seed a Draft from an existing entry for editing. */
export function entryToDraft(app: string, e: EntryInput): Draft {
  const type: EntryType = e.keys ? "shortcut" : e.command ? "command" : "recipe";
  return {
    ...emptyDraft,
    app,
    type,
    action: e.action,
    keys: e.keys ?? "",
    command: e.command ?? "",
    steps: e.steps ? [...e.steps] : [],
    tags: (e.tags ?? []).join(", "),
    notes: e.notes ?? "",
  };
}

export function useAddForm(initial: Partial<Draft> = {}) {
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft, ...initial }));
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  return { draft, update, setDraft };
}
