import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { entrySchema, fileShape } from "./schema";
import type { Entry, LoadError, LoadResult } from "./types";

const YAML_RE = /\.ya?ml$/;

export function loadEntries(dataDir: string): LoadResult {
  const entries: Entry[] = [];
  const errors: LoadError[] = [];

  let files: string[];
  try {
    files = readdirSync(dataDir)
      .filter((f) => YAML_RE.test(f))
      .sort();
  } catch (err) {
    errors.push({
      file: dataDir,
      entryIndex: null,
      message: `cannot read data dir: ${(err as Error).message}`,
    });
    return { entries, errors };
  }

  for (const file of files) {
    let raw: unknown;
    try {
      raw = parseYaml(readFileSync(join(dataDir, file), "utf8"));
    } catch (err) {
      errors.push({
        file,
        entryIndex: null,
        message: `YAML parse error: ${(err as Error).message}`,
      });
      continue;
    }

    const shape = fileShape.safeParse(raw);
    if (!shape.success) {
      errors.push({
        file,
        entryIndex: null,
        message: shape.error.issues[0]?.message ?? "invalid file shape",
      });
      continue;
    }

    const { app, entries: rawEntries } = shape.data;
    rawEntries.forEach((rawEntry, i) => {
      const parsed = entrySchema.safeParse(rawEntry);
      if (!parsed.success) {
        errors.push({
          file,
          entryIndex: i,
          message: parsed.error.issues.map((s) => s.message).join("; "),
        });
        return;
      }
      entries.push({ app, ...parsed.data });
    });
  }

  return { entries, errors };
}
