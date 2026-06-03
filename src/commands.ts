import { resolveDataDir } from "./config";
import { normalizeKeys } from "./data/keys";
import { loadEntries } from "./data/loader";
import type { EntryInput } from "./data/types";
import { addEntry } from "./data/writer";

export function runPath(env: NodeJS.ProcessEnv = process.env): string {
  const { dir, source } = resolveDataDir(env);
  return `${dir}  (source: ${source})`;
}

export interface CheckResult {
  ok: boolean;
  lines: string[];
}

export function runCheck(dir: string): CheckResult {
  const { entries, errors } = loadEntries(dir);
  if (errors.length === 0) return { ok: true, lines: [`✓ ${entries.length} entries OK`] };
  return {
    ok: false,
    lines: errors.map(
      (e) => `✗ ${e.file}${e.entryIndex !== null ? ` [entry ${e.entryIndex}]` : ""}: ${e.message}`,
    ),
  };
}

export interface AddDraft {
  app: string;
  action: string;
  keys?: string;
  command?: string;
  steps?: string[];
  tags?: string[];
  notes?: string;
}

export function runAdd(dir: string, draft: AddDraft): CheckResult {
  const entry: EntryInput = { action: draft.action };
  const keys = draft.keys ? normalizeKeys(draft.keys).trim() : "";
  if (keys) entry.keys = keys;
  if (draft.command?.trim()) entry.command = draft.command.trim();
  if (draft.steps?.length) entry.steps = draft.steps;
  if (draft.tags?.length) entry.tags = draft.tags;
  if (draft.notes?.trim()) entry.notes = draft.notes.trim();
  const result = addEntry(dir, draft.app, entry);
  return { ok: result.ok, lines: result.lines };
}
