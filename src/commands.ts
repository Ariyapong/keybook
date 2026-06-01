import { resolveDataDir } from "./config";
import { loadEntries } from "./data/loader";

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
