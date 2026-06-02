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

export function resolvedApp(d: Draft): string {
  return (d.creatingApp ? d.newApp : d.app).trim();
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

export function useAddForm() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  return { draft, update, setDraft };
}
