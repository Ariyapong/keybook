import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { Document, parseDocument } from "yaml";
import { loadEntries } from "./loader";
import { entrySchema } from "./schema";
import type { AddResult, EntryInput } from "./types";

const YAML_RE = /\.ya?ml$/;

function yamlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => YAML_RE.test(f))
    .sort();
}

function readApp(path: string): string | null {
  try {
    const app = parseDocument(readFileSync(path, "utf8")).get("app");
    return typeof app === "string" && app.trim() ? app.trim() : null;
  } catch {
    return null;
  }
}

export function listApps(dir: string): string[] {
  const seen = new Map<string, string>(); // lowercased -> first-seen casing
  for (const f of yamlFiles(dir)) {
    const app = readApp(join(dir, f));
    if (app && !seen.has(app.toLowerCase())) seen.set(app.toLowerCase(), app);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

function slugify(app: string): string {
  return (
    app
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "app"
  );
}

function findFileForApp(dir: string, app: string): string | null {
  const want = app.trim().toLowerCase();
  for (const f of yamlFiles(dir)) {
    if (readApp(join(dir, f))?.toLowerCase() === want) return join(dir, f);
  }
  return null;
}

function freshPath(dir: string, app: string): string {
  const base = slugify(app);
  let name = `${base}.yaml`;
  let n = 2;
  while (existsSync(join(dir, name))) {
    name = `${base}-${n}.yaml`;
    n += 1;
  }
  return join(dir, name);
}

function buildClean(e: EntryInput): EntryInput {
  const out: EntryInput = { action: e.action };
  if (e.keys) out.keys = e.keys;
  if (e.steps?.length) out.steps = e.steps;
  if (e.command) out.command = e.command;
  if (e.tags?.length) out.tags = e.tags;
  if (e.notes) out.notes = e.notes;
  if (e.source) out.source = e.source;
  return out;
}

function err(file: string, lines: string[], created = false): AddResult {
  return { ok: false, file, created, lines };
}

export function addEntry(dir: string, app: string, entry: EntryInput): AddResult {
  if ("app" in entry) {
    return err("", ["Error: entry must not have an app field; use --app instead"]);
  }
  if (!app.trim()) return err("", ["Error: app is required"]);

  const parsed = entrySchema.safeParse(entry);
  if (!parsed.success)
    return err(
      "",
      parsed.error.issues.map((i) => i.message),
    );
  const clean = buildClean(parsed.data);

  try {
    mkdirSync(dir, { recursive: true });
  } catch (e) {
    return err(dir, [(e as Error).message]);
  }

  const existing = findFileForApp(dir, app);
  const created = !existing;
  const file = existing ?? freshPath(dir, app);
  let original: string | null = null;

  let text: string;
  if (created) {
    text = new Document({ app: app.trim(), entries: [clean] }).toString();
  } else {
    try {
      original = readFileSync(file, "utf8");
    } catch (e) {
      return err(file, [(e as Error).message]);
    }
    const doc = parseDocument(original);
    doc.addIn(["entries"], doc.createNode(clean));
    text = doc.toString();
  }

  try {
    writeFileSync(file, text);
  } catch (e) {
    return err(file, [(e as Error).message], created);
  }

  // Safety net: never leave a file that fails `keybook check`.
  const fileErr = loadEntries(dir).errors.find((e) => e.file === basename(file));
  if (fileErr) {
    if (created) {
      try {
        unlinkSync(file);
      } catch {
        // best effort
      }
    } else if (original !== null) {
      writeFileSync(file, original);
    }
    return err(file, [`✗ ${fileErr.message}`], created);
  }

  return {
    ok: true,
    file,
    created,
    lines: [`✓ ${created ? "created" : "added to"} ${basename(file)}`],
  };
}
