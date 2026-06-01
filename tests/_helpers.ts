import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Create a temp dir containing the given YAML files; returns its path. */
export function tmpDataDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "keybook-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
}
