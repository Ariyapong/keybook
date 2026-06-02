# keybook `add` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `keybook add` — a guided interactive form (and scriptable flag mode) that authors a new shortcut/command/recipe entry and writes it to the right app YAML, validated through the existing zod schema.

**Architecture:** A new pure write path (`src/data/writer.ts`) appends an entry via the `yaml` Document AST (comment-preserving), validating with `entrySchema` and re-checking with `loadEntries` as a safety net. A pure key normalizer (`src/data/keys.ts`) turns `"shift cmd p"` into `"⇧⌘P"`. A `runAdd` command function powers a flag/non-interactive CLI mode. An Ink form (`AddEntryForm` + `useAddForm` hook + stateless `FormFields`/`StepsBuilder`/`ReviewScreen`) provides the interactive surface, launched both as a standalone `keybook add` subcommand and modally inside the search TUI via `⌃O`.

**Tech Stack:** TypeScript (strict, ESM), Ink/React, `yaml@2.9.0` (Document API), zod, commander, Vitest + ink-testing-library, biome, tsdown. **No new dependencies.**

**Reference spec:** `docs/superpowers/specs/2026-06-02-keybook-add-design.md`

**Conventions:**
- TDD: write the failing test, watch it fail, implement, watch it pass, commit.
- One commit per task. All commands run from the repo root.
- Commit-message style matches the log: `feat(...)`, `refactor(...)`, `docs:`. **No `Co-Authored-By` trailer.**
- After each task, `pnpm test`, `pnpm typecheck`, `pnpm lint` must stay green.
- macOS glyph convention for any `keys` string: `⌘⌥⌃⇧⏎⎋⌫⇥␣↑↓←→`, modifier order `⌃⌥⇧⌘`, chords comma-separated.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/data/keys.ts` | **New.** Pure `normalizeKeys(input)` — words/ascii/glyphs → canonical glyph string. |
| `src/data/types.ts` | **Modify.** Export `EntryInput = Omit<Entry,'app'>` and `AddResult`. |
| `src/data/writer.ts` | **New.** `listApps(dir)` and `addEntry(dir, app, entry)` — the only YAML writer. |
| `src/commands.ts` | **Modify.** `runAdd(dir, draft)` → `{ ok, lines }`, mirroring `runCheck`. |
| `src/cli.ts` | **Modify.** Register `add` subcommand: flag mode + interactive render + dispatch. |
| `src/tui/KeyCaps.tsx` | **New.** Extracted from `PreviewPane` so `ReviewScreen` can reuse it. |
| `src/tui/PreviewPane.tsx` | **Modify.** Import `KeyCaps` instead of defining it. |
| `src/tui/useAddForm.ts` | **New.** `Draft` type, pure helpers (`parseTags`, `validateDraft`, `draftToEntryInput`, `resolvedApp`), and the `useAddForm` hook. |
| `src/tui/StepsBuilder.tsx` | **New.** Stateless append-only steps view. |
| `src/tui/FormFields.tsx` | **New.** Stateless field view. |
| `src/tui/ReviewScreen.tsx` | **New.** Stateless review view. |
| `src/tui/AddEntryForm.tsx` | **New.** Orchestrator: single `useInput`, wires the hook to the views. |
| `src/tui/Footer.tsx` | **Modify.** Add `⌃O add` hint. |
| `src/tui/App.tsx` | **Modify.** `dataDir` prop, entries-in-state + `reload()`, `mode`, modal render, `⌃O`. |
| `README.md` | **Modify.** Document `keybook add` in Usage. |

---

## Task 1: Key normalizer (`normalizeKeys`)

**Files:**
- Create: `tests/keys.test.ts`
- Create: `src/data/keys.ts`

- [ ] **Step 1: Write the failing test** — `tests/keys.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { normalizeKeys } from "../src/data/keys";

describe("normalizeKeys", () => {
  it("turns words into glyphs", () => {
    expect(normalizeKeys("shift cmd p")).toBe("⇧⌘P");
  });
  it("is idempotent on glyph input", () => {
    expect(normalizeKeys("⇧⌘P")).toBe("⇧⌘P");
    expect(normalizeKeys("shift cmd p")).toBe(normalizeKeys("⇧⌘P"));
  });
  it("canonicalizes modifier order to ⌃⌥⇧⌘", () => {
    expect(normalizeKeys("cmd shift ctrl opt a")).toBe("⌃⌥⇧⌘A");
  });
  it("de-dupes repeated modifiers", () => {
    expect(normalizeKeys("shift cmd cmd p")).toBe("⇧⌘P");
  });
  it("accepts + as a separator", () => {
    expect(normalizeKeys("shift+cmd+p")).toBe("⇧⌘P");
  });
  it("maps named keys", () => {
    expect(normalizeKeys("cmd return")).toBe("⌘⏎");
    expect(normalizeKeys("ctrl space")).toBe("⌃␣");
  });
  it("splits chords on comma or 'then' and trims each", () => {
    expect(normalizeKeys("  ctrl b ,  % ")).toBe("⌃B, %");
    expect(normalizeKeys("ctrl b then %")).toBe("⌃B, %");
  });
  it("preserves unrecognized tokens verbatim", () => {
    expect(normalizeKeys("foo")).toBe("foo");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test keys`
Expected: FAIL — module `../src/data/keys` does not exist.

- [ ] **Step 3: Implement `src/data/keys.ts`**

```ts
const MODS: Record<string, string> = {
  cmd: "⌘", command: "⌘", "⌘": "⌘",
  opt: "⌥", option: "⌥", alt: "⌥", "⌥": "⌥",
  ctrl: "⌃", control: "⌃", "⌃": "⌃",
  shift: "⇧", "⇧": "⇧",
};

const NAMED: Record<string, string> = {
  return: "⏎", enter: "⏎", "⏎": "⏎",
  esc: "⎋", escape: "⎋", "⎋": "⎋",
  del: "⌫", delete: "⌫", backspace: "⌫", "⌫": "⌫",
  tab: "⇥", "⇥": "⇥",
  space: "␣", "␣": "␣",
  up: "↑", down: "↓", left: "←", right: "→",
  "↑": "↑", "↓": "↓", "←": "←", "→": "→",
};

const MOD_ORDER = ["⌃", "⌥", "⇧", "⌘"];

function normalizeSegment(seg: string): string {
  const trimmed = seg.trim();
  if (!trimmed) return "";
  const tokens = trimmed.split(/[\s+]+/).filter(Boolean);
  const mods = new Set<string>();
  const keys: string[] = [];
  for (const tok of tokens) {
    const low = tok.toLowerCase();
    if (MODS[low]) {
      mods.add(MODS[low]);
    } else if (NAMED[low]) {
      keys.push(NAMED[low]);
    } else {
      keys.push(tok.length === 1 ? tok.toUpperCase() : tok);
    }
  }
  const orderedMods = MOD_ORDER.filter((m) => mods.has(m));
  return orderedMods.join("") + keys.join("");
}

/** Normalize human key input into the canonical macOS glyph string. Never throws. */
export function normalizeKeys(input: string): string {
  return input
    .split(/\s*,\s*|\s+then\s+/i)
    .map(normalizeSegment)
    .filter(Boolean)
    .join(", ");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test keys`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/keys.ts tests/keys.test.ts
git commit -m "feat(data): normalizeKeys — words/ascii to macOS glyphs"
```

---

## Task 2: Writer types + core `addEntry`/`listApps`

**Files:**
- Modify: `src/data/types.ts`
- Create: `src/data/writer.ts`
- Create: `tests/writer.test.ts`

- [ ] **Step 1: Add types** — append to `src/data/types.ts`

```ts
export type EntryInput = Omit<Entry, "app">;

export interface AddResult {
  ok: boolean;
  file: string; // path written (or attempted); "" before a file is chosen
  created: boolean; // true if a new app file was created
  lines: string[]; // runCheck-style human-readable messages
}
```

- [ ] **Step 2: Write the failing test** — `tests/writer.test.ts`

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadEntries } from "../src/data/loader";
import { addEntry, listApps } from "../src/data/writer";
import { tmpDataDir } from "./_helpers";

const FORK = `app: Fork
entries:
  - action: Pull
    keys: "⇧⌘L"
    tags: [pull]
`;

describe("listApps", () => {
  it("returns sorted, de-duped app names", () => {
    const dir = tmpDataDir({ "fork.yaml": FORK, "z.yaml": "app: Zed\nentries:\n  - action: X\n    keys: a\n" });
    expect(listApps(dir)).toEqual(["Fork", "Zed"]);
  });
  it("includes apps from files whose entries are invalid, as long as app is readable", () => {
    const dir = tmpDataDir({ "broken.yaml": "app: Broken\nentries:\n  - notAField: 1\n" });
    expect(listApps(dir)).toEqual(["Broken"]);
  });
});

describe("addEntry — append to existing", () => {
  it("appends a valid entry and round-trips through loadEntries", () => {
    const dir = tmpDataDir({ "fork.yaml": FORK });
    const res = addEntry(dir, "Fork", { action: "Push", keys: "⇧⌘P", tags: ["push"] });
    expect(res.ok).toBe(true);
    expect(res.created).toBe(false);
    const { entries, errors } = loadEntries(dir);
    expect(errors).toEqual([]);
    expect(entries.find((e) => e.action === "Push")?.keys).toBe("⇧⌘P");
  });
  it("matches the app case- and whitespace-insensitively", () => {
    const dir = tmpDataDir({ "fork.yaml": FORK });
    const res = addEntry(dir, "  fork ", { action: "Push", keys: "⇧⌘P" });
    expect(res.ok).toBe(true);
    expect(res.file.endsWith("fork.yaml")).toBe(true);
  });
});

describe("addEntry — create new app", () => {
  it("creates <slug>.yaml with the right shape and no app field on the entry", () => {
    const dir = tmpDataDir({});
    const res = addEntry(dir, "My App", { action: "Open", command: "open ." });
    expect(res.ok).toBe(true);
    expect(res.created).toBe(true);
    expect(res.file.endsWith("my-app.yaml")).toBe(true);
    const text = readFileSync(join(dir, "my-app.yaml"), "utf8");
    expect(text).toContain("app: My App");
    const { entries, errors } = loadEntries(dir);
    expect(errors).toEqual([]);
    expect(entries[0]).toMatchObject({ app: "My App", action: "Open", command: "open ." });
  });
});

describe("addEntry — validation", () => {
  it("rejects an entry with none of keys/steps/command, without writing", () => {
    const dir = tmpDataDir({ "fork.yaml": FORK });
    const before = readFileSync(join(dir, "fork.yaml"), "utf8");
    const res = addEntry(dir, "Fork", { action: "Nothing" });
    expect(res.ok).toBe(false);
    expect(res.lines.join(" ")).toMatch(/keys, steps, command/);
    expect(readFileSync(join(dir, "fork.yaml"), "utf8")).toBe(before);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test writer`
Expected: FAIL — module `../src/data/writer` does not exist.

- [ ] **Step 4: Implement `src/data/writer.ts`**

```ts
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { Document, parseDocument } from "yaml";
import { loadEntries } from "./loader";
import { entrySchema } from "./schema";
import type { AddResult, EntryInput } from "./types";

const YAML_RE = /\.ya?ml$/;

function yamlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => YAML_RE.test(f)).sort();
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
  return app.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app";
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
  if (!parsed.success) return err("", parsed.error.issues.map((i) => i.message));
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

  return { ok: true, file, created, lines: [`✓ ${created ? "created" : "added to"} ${basename(file)}`] };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test writer`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/writer.ts src/data/types.ts tests/writer.test.ts
git commit -m "feat(data): addEntry/listApps — comment-preserving YAML write path"
```

---

## Task 3: Writer edge cases (preservation, slug collision, restore, stray app)

**Files:**
- Modify: `tests/writer.test.ts`

- [ ] **Step 1: Add the failing tests** — append to `tests/writer.test.ts`

```ts
describe("addEntry — preservation & edge cases", () => {
  it("preserves comments and leaves existing entries semantically identical", () => {
    const withComment = `# my notes\napp: Nano\nentries:\n  - action: Save\n    keys: "⌃O"\n`;
    const dir = tmpDataDir({ "nano.yaml": withComment });
    const before = loadEntries(dir).entries;
    const res = addEntry(dir, "Nano", { action: "Quit", keys: "⌃X" });
    expect(res.ok).toBe(true);
    const text = readFileSync(join(dir, "nano.yaml"), "utf8");
    expect(text).toContain("# my notes"); // comment survives
    const after = loadEntries(dir).entries;
    // existing entry unchanged as parsed
    expect(after.find((e) => e.action === "Save")).toEqual(before.find((e) => e.action === "Save"));
  });

  it("avoids overwriting an unrelated file by suffixing the slug", () => {
    const dir = tmpDataDir({ "fork.yaml": "app: ForkLift\nentries:\n  - action: X\n    keys: a\n" });
    const before = readFileSync(join(dir, "fork.yaml"), "utf8");
    const res = addEntry(dir, "Fork", { action: "Push", keys: "⇧⌘P" });
    expect(res.ok).toBe(true);
    expect(res.created).toBe(true);
    expect(res.file.endsWith("fork-2.yaml")).toBe(true);
    expect(readFileSync(join(dir, "fork.yaml"), "utf8")).toBe(before); // untouched
  });

  it("rejects an entry that carries an app field with a friendly message", () => {
    const dir = tmpDataDir({});
    const res = addEntry(dir, "Fork", { action: "X", keys: "a", app: "Fork" } as never);
    expect(res.ok).toBe(false);
    expect(res.lines.join(" ")).toMatch(/must not have an app field/);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test writer`
Expected: PASS (Task 2's implementation already covers these — this task locks the behavior with tests). If any fail, fix `writer.ts` minimally until green.

- [ ] **Step 3: Commit**

```bash
git add tests/writer.test.ts
git commit -m "test(data): cover writer preservation, slug collision, stray-app guard"
```

---

## Task 4: `runAdd` command function

**Files:**
- Modify: `src/commands.ts`
- Modify: `tests/commands.test.ts`

- [ ] **Step 1: Write the failing test** — append to `tests/commands.test.ts`

```ts
import { runAdd } from "../src/commands";
import { loadEntries } from "../src/data/loader";
import { tmpDataDir } from "./_helpers";

describe("runAdd", () => {
  it("normalizes keys and writes a valid entry", () => {
    const dir = tmpDataDir({ "fork.yaml": "app: Fork\nentries:\n  - action: Pull\n    keys: \"⇧⌘L\"\n" });
    const res = runAdd(dir, { app: "Fork", action: "Push", keys: "shift cmd p" });
    expect(res.ok).toBe(true);
    expect(loadEntries(dir).entries.find((e) => e.action === "Push")?.keys).toBe("⇧⌘P");
  });
  it("fails when no keys/steps/command are given", () => {
    const dir = tmpDataDir({});
    const res = runAdd(dir, { app: "Fork", action: "Nothing" });
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test commands`
Expected: FAIL — `runAdd` is not exported.

- [ ] **Step 3: Implement `runAdd`** — add to `src/commands.ts`

```ts
import { normalizeKeys } from "./data/keys";
import { addEntry } from "./data/writer";
import type { EntryInput } from "./data/types";

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test commands`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands.ts tests/commands.test.ts
git commit -m "feat(commands): runAdd — normalize keys and append via addEntry"
```

---

## Task 5: `keybook add` flag/non-interactive CLI mode

**Files:**
- Modify: `src/cli.ts`
- Modify: `tests/integration.test.ts`

> Interactive rendering of the form is wired in Task 11; this task handles the flag path and exit codes only. The action stub for the interactive branch prints a TODO-free message and exits 0 until Task 11 replaces it.

- [ ] **Step 1: Write the failing integration tests** — append to `tests/integration.test.ts`

```ts
it("add (flag mode) writes an entry and check passes", () => {
  const dir = tmpDataDir({ "fork.yaml": "app: Fork\nentries:\n  - action: Pull\n    keys: \"⇧⌘L\"\n" });
  execFileSync("node", [CLI, "add", "--app", "Fork", "--action", "Push", "--keys", "shift cmd p"], {
    env: { ...process.env, KEYBOOK_DATA_DIR: dir },
  });
  const out = execFileSync("node", [CLI, "check"], {
    env: { ...process.env, KEYBOOK_DATA_DIR: dir },
    encoding: "utf8",
  });
  expect(out).toMatch(/entries OK/);
});

it("add with a missing required field exits 2 and names it (non-TTY)", () => {
  const dir = tmpDataDir({});
  let code = 0;
  let stderr = "";
  try {
    execFileSync("node", [CLI, "add", "--app", "Fork", "--keys", "x"], {
      env: { ...process.env, KEYBOOK_DATA_DIR: dir },
      encoding: "utf8",
    });
  } catch (e) {
    code = (e as { status: number }).status;
    stderr = String((e as { stderr: string }).stderr);
  }
  expect(code).toBe(2);
  expect(stderr).toMatch(/action/);
});
```

> `CLI` and `tmpDataDir` are already imported at the top of `tests/integration.test.ts`; reuse them. If `CLI` points at `dist/cli.js`, the existing `beforeAll` build step covers it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm build && pnpm test integration`
Expected: FAIL — there is no `add` subcommand yet.

- [ ] **Step 3: Implement the `add` subcommand** — add to `src/cli.ts` (before `program.parse()`)

```ts
import { runAdd } from "./commands";
// (resolveDataDir, ensureDataDir, loadEntries already imported)

program
  .command("add")
  .description("Add a new entry (interactive, or non-interactive with flags)")
  .option("--app <name>", "target app")
  .option("--action <text>", "what the entry does")
  .option("--keys <combo>", "key combo (glyphs or words, e.g. 'shift cmd p')")
  .option("--command <cmd>", "terminal command")
  .option("--step <text...>", "recipe step (repeatable)")
  .option("--tags <list>", "comma-separated tags")
  .option("--notes <text>", "notes")
  .action((opts: Record<string, string | string[] | undefined>) => {
    const { dir } = resolveDataDir();
    ensureDataDir(dir);

    const app = opts.app as string | undefined;
    const action = opts.action as string | undefined;
    const keys = opts.keys as string | undefined;
    const command = opts.command as string | undefined;
    const steps = (opts.step as string[] | undefined) ?? undefined;
    const tags = typeof opts.tags === "string"
      ? opts.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : undefined;
    const notes = opts.notes as string | undefined;

    const haveBody = Boolean(keys || command || steps?.length);
    const complete = Boolean(app && action && haveBody);

    if (complete) {
      const result = runAdd(dir, { app: app as string, action: action as string, keys, command, steps, tags, notes });
      for (const line of result.lines) (result.ok ? console.log : console.error)(line);
      process.exit(result.ok ? 0 : 1);
    }

    if (!process.stdout.isTTY) {
      const missing = [!app && "--app", !action && "--action", !haveBody && "--keys/--command/--step"]
        .filter(Boolean)
        .join(", ");
      console.error(`Error: missing required field(s): ${missing}`);
      process.exit(2);
    }

    // Interactive fallback wired in Task 11.
    console.log("(interactive add — coming in Task 11)");
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm build && pnpm test integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts tests/integration.test.ts
git commit -m "feat(cli): keybook add flag mode (exit 0/1/2; --keys normalized)"
```

---

## Task 6: Extract `KeyCaps` for reuse

**Files:**
- Create: `src/tui/KeyCaps.tsx`
- Modify: `src/tui/PreviewPane.tsx`

> Pure refactor — no behavior change. Existing `tests/tui-components.test.tsx` (incl. the `⌃X⌃E` duplicate-key regression) must stay green.

- [ ] **Step 1: Create `src/tui/KeyCaps.tsx`** (move the function out of `PreviewPane.tsx` verbatim)

```tsx
import { Box, Text } from "ink";
import { parseKeys } from "./keycaps";

export function KeyCaps({ value }: { value: string }) {
  const chords = parseKeys(value);
  return (
    <Box>
      {chords.map((seg, si) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable; tokens can repeat (e.g. ⌃X⌃E) so the value is not a unique key
        <Box key={si}>
          {si > 0 ? <Text> , </Text> : null}
          {seg.map((tok, ti) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: see above — repeated tokens make the value non-unique
            <Box key={ti} marginRight={1} borderStyle="round" paddingX={1}>
              <Text bold>{tok}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
```

- [ ] **Step 2: Update `src/tui/PreviewPane.tsx`** — delete the local `KeyCaps` function and `import { parseKeys }`, and add:

```tsx
import { KeyCaps } from "./KeyCaps";
```

(The rest of `PreviewPane` is unchanged; it still calls `<KeyCaps value={entry.keys} />`.)

- [ ] **Step 3: Run the tests**

Run: `pnpm test tui-components && pnpm typecheck`
Expected: PASS — same output as before.

- [ ] **Step 4: Commit**

```bash
git add src/tui/KeyCaps.tsx src/tui/PreviewPane.tsx
git commit -m "refactor(tui): extract KeyCaps into its own module"
```

---

## Task 7: `useAddForm` hook + pure helpers

**Files:**
- Create: `src/tui/useAddForm.ts`
- Create: `tests/useAddForm.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/useAddForm.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { type Draft, draftToEntryInput, emptyDraft, parseTags, resolvedApp, validateDraft } from "../src/tui/useAddForm";

const base: Draft = { ...emptyDraft, app: "Fork", action: "Push", type: "shortcut", keys: "shift cmd p" };

describe("parseTags", () => {
  it("splits, trims, and drops empties", () => {
    expect(parseTags("push, upload ,  ")).toEqual(["push", "upload"]);
  });
});

describe("resolvedApp", () => {
  it("uses newApp when creating", () => {
    expect(resolvedApp({ ...emptyDraft, creatingApp: true, newApp: " Zed " })).toBe("Zed");
  });
});

describe("validateDraft", () => {
  it("passes for a complete shortcut", () => {
    expect(validateDraft(base)).toBeNull();
  });
  it("requires app and action", () => {
    expect(validateDraft({ ...base, app: "" })).toMatch(/App/);
    expect(validateDraft({ ...base, action: "" })).toMatch(/Action/);
  });
  it("requires keys, command, or a step", () => {
    expect(validateDraft({ ...base, keys: "" })).toMatch(/keys|command|step/i);
  });
  it("treats whitespace-only keys as empty", () => {
    expect(validateDraft({ ...base, keys: "   " })).toMatch(/keys|command|step/i);
  });
});

describe("draftToEntryInput", () => {
  it("normalizes keys and includes only populated fields", () => {
    expect(draftToEntryInput(base)).toEqual({ action: "Push", keys: "⇧⌘P" });
  });
  it("includes steps and tags when present", () => {
    const d: Draft = { ...emptyDraft, app: "Finder", action: "X", type: "recipe", steps: ["a", "b"], tags: "x, y" };
    expect(draftToEntryInput(d)).toEqual({ action: "X", steps: ["a", "b"], tags: ["x", "y"] });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test useAddForm`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tui/useAddForm.ts`**

```ts
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
  app: "", newApp: "", creatingApp: false, type: "shortcut",
  action: "", keys: "", command: "", steps: [], stepLine: "", tags: "", notes: "",
};

export function parseTags(raw: string): string[] {
  return raw.split(",").map((t) => t.trim()).filter(Boolean);
}

export function resolvedApp(d: Draft): string {
  return (d.creatingApp ? d.newApp : d.app).trim();
}

export function validateDraft(d: Draft): string | null {
  if (!resolvedApp(d)) return "App is required";
  if (!d.action.trim()) return "Action is required";
  const has = Boolean(normalizeKeys(d.keys).trim()) || Boolean(d.command.trim()) || d.steps.length > 0;
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test useAddForm`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/useAddForm.ts tests/useAddForm.test.ts
git commit -m "feat(tui): useAddForm hook + pure draft helpers"
```

---

## Task 8: `StepsBuilder` (stateless, append-only)

**Files:**
- Create: `src/tui/StepsBuilder.tsx`
- Create: `tests/steps-builder.test.tsx`

- [ ] **Step 1: Write the failing test** — `tests/steps-builder.test.tsx`

```tsx
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { StepsBuilder } from "../src/tui/StepsBuilder";

describe("StepsBuilder", () => {
  it("renders numbered steps and the active line", () => {
    const { lastFrame } = render(<StepsBuilder steps={["Open menu", "Click save"]} line="type me" active />);
    const out = lastFrame() ?? "";
    expect(out).toContain("1. Open menu");
    expect(out).toContain("2. Click save");
    expect(out).toContain("type me");
  });
  it("shows a hint when there are no steps", () => {
    const { lastFrame } = render(<StepsBuilder steps={[]} line="" active />);
    expect(lastFrame() ?? "").toMatch(/⏎ adds a step/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test steps-builder`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tui/StepsBuilder.tsx`**

```tsx
import { Box, Text } from "ink";

export function StepsBuilder({ steps, line, active }: { steps: string[]; line: string; active: boolean }) {
  return (
    <Box flexDirection="column">
      {steps.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: steps are an ordered append-only list; duplicates are allowed so the value is not a unique key
        <Text key={i}>
          {i + 1}. {s}
        </Text>
      ))}
      <Box>
        <Text color={active ? "cyan" : "gray"}>{steps.length + 1}. </Text>
        <Text>{line}</Text>
        {active ? <Text inverse> </Text> : null}
      </Box>
      {steps.length === 0 ? <Text color="gray">⏎ adds a step · ⌫ on an empty line removes the last</Text> : null}
    </Box>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test steps-builder`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/StepsBuilder.tsx tests/steps-builder.test.tsx
git commit -m "feat(tui): StepsBuilder — append-only recipe steps view"
```

---

## Task 9: `FormFields` + `ReviewScreen` (stateless views)

**Files:**
- Create: `src/tui/FormFields.tsx`
- Create: `src/tui/ReviewScreen.tsx`
- Create: `tests/form-views.test.tsx`

- [ ] **Step 1: Write the failing test** — `tests/form-views.test.tsx`

```tsx
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { FormFields } from "../src/tui/FormFields";
import { ReviewScreen } from "../src/tui/ReviewScreen";
import { emptyDraft } from "../src/tui/useAddForm";

describe("FormFields", () => {
  it("shows the live glyph preview for keys", () => {
    const draft = { ...emptyDraft, app: "Fork", type: "shortcut" as const, keys: "shift cmd p" };
    const { lastFrame } = render(<FormFields draft={draft} apps={["Fork"]} appIndex={0} focused={3} />);
    expect(lastFrame() ?? "").toContain("⇧⌘P");
  });
});

describe("ReviewScreen", () => {
  it("renders the entry as keycaps and the target path", () => {
    const { lastFrame } = render(
      <ReviewScreen app="Fork" entry={{ action: "Push", keys: "⇧⌘P" }} targetPath="/x/fork.yaml" error="" />,
    );
    const out = lastFrame() ?? "";
    expect(out).toContain("Push");
    expect(out).toContain("⇧");
    expect(out).toContain("fork.yaml");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test form-views`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/tui/FormFields.tsx`**

```tsx
import { Box, Text } from "ink";
import { normalizeKeys } from "../data/keys";
import { StepsBuilder } from "./StepsBuilder";
import type { Draft } from "./useAddForm";

const TYPES: Array<Draft["type"]> = ["shortcut", "command", "recipe"];

function Field({ label, value, focused }: { label: string; value: string; focused: boolean }) {
  return (
    <Box>
      <Text color={focused ? "cyan" : "gray"}>{label.padEnd(8)}</Text>
      <Text>{value}</Text>
      {focused ? <Text inverse> </Text> : null}
    </Box>
  );
}

export function FormFields({
  draft,
  apps,
  appIndex,
  focused,
}: {
  draft: Draft;
  apps: string[];
  appIndex: number;
  focused: number;
}) {
  const appChoices = [...apps, "Create new app…"];
  return (
    <Box flexDirection="column">
      {/* 0: app */}
      <Box>
        <Text color={focused === 0 ? "cyan" : "gray"}>{"App".padEnd(8)}</Text>
        {draft.creatingApp ? (
          <>
            <Text>{draft.newApp}</Text>
            {focused === 0 ? <Text inverse> </Text> : null}
          </>
        ) : (
          <Text>{appChoices[appIndex] ?? "—"}{focused === 0 ? "  (↑/↓)" : ""}</Text>
        )}
      </Box>
      {/* 1: type */}
      <Box>
        <Text color={focused === 1 ? "cyan" : "gray"}>{"Type".padEnd(8)}</Text>
        <Text>{TYPES.map((t) => (t === draft.type ? `(•) ${t}` : `( ) ${t}`)).join("  ")}</Text>
      </Box>
      {/* 2: action */}
      <Field label="Action" value={draft.action} focused={focused === 2} />
      {/* 3: primary */}
      {draft.type === "shortcut" ? (
        <Box>
          <Text color={focused === 3 ? "cyan" : "gray"}>{"Keys".padEnd(8)}</Text>
          <Text>{draft.keys}</Text>
          {focused === 3 ? <Text inverse> </Text> : null}
          {draft.keys.trim() ? <Text color="gray">{"  →  "}{normalizeKeys(draft.keys)}</Text> : null}
        </Box>
      ) : draft.type === "command" ? (
        <Field label="Command" value={`$ ${draft.command}`} focused={focused === 3} />
      ) : (
        <Box flexDirection="column">
          <Text color={focused === 3 ? "cyan" : "gray"}>Steps</Text>
          <StepsBuilder steps={draft.steps} line={draft.stepLine} active={focused === 3} />
        </Box>
      )}
      {/* 4: tags */}
      <Field label="Tags" value={draft.tags} focused={focused === 4} />
      {/* 5: notes */}
      <Field label="Notes" value={draft.notes} focused={focused === 5} />
    </Box>
  );
}
```

- [ ] **Step 4: Implement `src/tui/ReviewScreen.tsx`**

```tsx
import { Box, Text } from "ink";
import type { EntryInput } from "../data/types";
import { KeyCaps } from "./KeyCaps";

export function ReviewScreen({
  app,
  entry,
  targetPath,
  error,
}: {
  app: string;
  entry: EntryInput;
  targetPath: string;
  error: string;
}) {
  return (
    <Box flexDirection="column">
      <Text color="cyan">Review — {app}</Text>
      <Text bold>{entry.action}</Text>
      <Box marginTop={1} flexDirection="column">
        {entry.keys ? <KeyCaps value={entry.keys} /> : null}
        {entry.steps?.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: ordered append-only step list
          <Text key={i}>
            {i + 1}. {s}
          </Text>
        ))}
        {entry.command ? <Text color="green">$ {entry.command}</Text> : null}
      </Box>
      {entry.tags?.length ? <Text color="gray">tags: {entry.tags.join(", ")}</Text> : null}
      {entry.notes ? <Text color="gray">{entry.notes}</Text> : null}
      <Text color="gray">→ {targetPath}</Text>
      {error ? <Text color="red">{error}</Text> : null}
      <Box marginTop={1}>
        <Text color="gray">⏎ save · e edit · esc cancel</Text>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test form-views`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tui/FormFields.tsx src/tui/ReviewScreen.tsx tests/form-views.test.tsx
git commit -m "feat(tui): FormFields + ReviewScreen stateless views"
```

---

## Task 10: `AddEntryForm` orchestrator

**Files:**
- Create: `src/tui/AddEntryForm.tsx`
- Create: `tests/add-form.test.tsx`

> The form owns a single `useInput`. Keystroke protocol: `⌃N`/`⌃P` move between the 6 fields; `↑/↓` move the app selection (field 0); `←/→` cycle the type (field 1); in steps (field 3, recipe) `⏎` appends `stepLine`, `⌫` on an empty line removes the last step; elsewhere `⏎` goes to review (running `validateDraft`); printable input edits the focused text field; `esc` cancels. On review: `⏎` calls `onSubmit` once, `e` returns to editing, `esc` cancels.

- [ ] **Step 1: Write the failing test** — `tests/add-form.test.tsx`

```tsx
import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { AddResult } from "../src/data/types";
import { AddEntryForm } from "../src/tui/AddEntryForm";

const ok: AddResult = { ok: true, file: "/x/fork.yaml", created: false, lines: ["✓ added to fork.yaml"] };
const tick = () => new Promise((r) => setTimeout(r, 30));

function setup(onSubmit = vi.fn(() => ok)) {
  const onComplete = vi.fn();
  const onCancel = vi.fn();
  const r = render(<AddEntryForm apps={["Fork"]} onSubmit={onSubmit} onComplete={onComplete} onCancel={onCancel} />);
  return { ...r, onSubmit, onComplete, onCancel };
}

describe("AddEntryForm", () => {
  it("shows the live glyph preview while typing keys", async () => {
    const { stdin, lastFrame } = setup();
    await tick();
    stdin.write("\x0e"); // ⌃N -> Type
    stdin.write("\x10"); // ⌃P -> back to App; choose Fork is index 0 already
    // move to Action (field 2): ⌃N twice from App
    stdin.write("\x0e"); // Type
    stdin.write("\x0e"); // Action
    stdin.write("Push");
    stdin.write("\x0e"); // Keys
    stdin.write("shift cmd p");
    await tick();
    expect(lastFrame() ?? "").toContain("⇧⌘P");
  });

  it("does not call onSubmit until the review is confirmed, then exactly once", async () => {
    const { stdin, onSubmit, onComplete } = setup();
    await tick();
    stdin.write("\x0e\x0e"); // App -> Type -> Action
    stdin.write("Push");
    stdin.write("\x0e"); // Keys
    stdin.write("shift cmd p");
    await tick();
    expect(onSubmit).not.toHaveBeenCalled();
    stdin.write("\r"); // go to review
    await tick();
    stdin.write("\r"); // confirm
    await tick();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(ok);
  });

  it("cancels on esc", async () => {
    const { stdin, onCancel } = setup();
    await tick();
    stdin.write("\x1b"); // esc
    await tick();
    expect(onCancel).toHaveBeenCalled();
  });
});
```

> Control-byte reference for tests: `⌃N` = `\x0e`, `⌃P` = `\x10`, `⏎` = `\r`, `esc` = `\x1b`. The first list entry (`Fork`) is selected by default so the example skips app navigation.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test add-form`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/tui/AddEntryForm.tsx`**

```tsx
import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { AddResult, EntryInput } from "../data/types";
import { FormFields } from "./FormFields";
import { ReviewScreen } from "./ReviewScreen";
import { draftToEntryInput, resolvedApp, useAddForm, validateDraft, type EntryType } from "./useAddForm";

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
    const v = validateDraft({ ...draft, app: appIndex < apps.length ? (apps[appIndex] ?? "") : draft.app, creatingApp: appIndex === apps.length });
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
        const next = key.leftArrow ? (idx + TYPES.length - 1) % TYPES.length : (idx + 1) % TYPES.length;
        return update({ type: TYPES[next] });
      }
      if (key.return) return goReview();
      return;
    }

    // Field 3 recipe: steps builder
    if (focused === 3 && draft.type === "recipe") {
      if (key.return) {
        if (draft.stepLine.trim()) update({ steps: [...draft.steps, draft.stepLine.trim()], stepLine: "" });
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
      focused === 2 ? "action" :
      focused === 3 ? (draft.type === "command" ? "command" : "keys") :
      focused === 4 ? "tags" : "notes";
    if (key.backspace || key.delete) return update({ [fieldKey]: (draft[fieldKey] as string).slice(0, -1) });
    if (input && !key.ctrl && !key.meta) return update({ [fieldKey]: (draft[fieldKey] as string) + input });
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
        <Text color={hint ? "red" : "gray"}>{hint || "⌃N next · ⌃P prev · ⏎ review · esc cancel"}</Text>
      </Box>
    </Box>
  );
}
```

> Note for the implementer: the `[fieldKey]: …` dynamic update relies on `Draft` having string-typed `action/keys/command/tags/notes`. Keep `goReview`'s validation in sync with the chosen app selection (the snippet recomputes `app`/`creatingApp` from `appIndex` so a not-yet-committed selection still validates). Adjust the exact `tick` delays if ink-testing-library needs more time; the assertions, not the timings, are authoritative.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test add-form`
Expected: PASS (3 tests). Iterate on the input handling until green.

- [ ] **Step 5: Commit**

```bash
git add src/tui/AddEntryForm.tsx tests/add-form.test.tsx
git commit -m "feat(tui): AddEntryForm orchestrator (single useInput, review/confirm)"
```

---

## Task 11: Wire the standalone interactive `keybook add`

**Files:**
- Modify: `src/cli.ts`

- [ ] **Step 1: Replace the interactive stub** in the `add` action (from Task 5)

Replace the line `console.log("(interactive add — coming in Task 11)");` with:

```ts
    const { entries } = loadEntries(dir);
    const existingTags = [...new Set(entries.flatMap((e) => e.tags ?? []))].sort();
    const prefill = { app, action, keys, command, steps, tags, notes };
    const { waitUntilExit } = render(
      createElement(AddEntryForm, {
        apps: listApps(dir),
        existingTags,
        // prefill is available for a future enhancement; the form starts empty in v0.3
        onSubmit: (a: string, entry: EntryInput) => addEntry(dir, a, entry),
        onComplete: (result: AddResult) => {
          for (const line of result.lines) console.log(line);
        },
        onCancel: () => process.exit(0),
      }),
    );
    void prefill;
    waitUntilExit().then(() => process.exit(0));
```

Add the imports at the top of `src/cli.ts`:

```ts
import { AddEntryForm } from "./tui/AddEntryForm";
import { addEntry, listApps } from "./data/writer";
import type { AddResult, EntryInput } from "./data/types";
```

(`render` from `ink`, `createElement` from `react`, and `loadEntries` are already imported.)

- [ ] **Step 2: Manual smoke (no automated test — interactive render)**

Run: `KEYBOOK_DATA_DIR=$(mktemp -d) pnpm dev add`
Expected: the form renders; you can fill it, reach review with `⏎`, confirm with `⏎`, and see `✓ created …`; `esc` exits cleanly.

- [ ] **Step 3: Verify the suite still passes & build**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: all green; `dist/cli.js` builds.

- [ ] **Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat(cli): render the interactive add form for keybook add"
```

---

## Task 12: Footer hint

**Files:**
- Modify: `src/tui/Footer.tsx`
- Modify: `tests/tui-components.test.tsx`

- [ ] **Step 1: Add the failing assertion** — append to the `describe("Footer", …)` block in `tests/tui-components.test.tsx`

```tsx
it("hints at the add binding", () => {
  const { lastFrame } = render(<Footer flash="" errorCount={0} resultCount={5} />);
  expect(lastFrame() ?? "").toContain("⌃O");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tui-components`
Expected: FAIL — footer does not mention `⌃O`.

- [ ] **Step 3: Update `src/tui/Footer.tsx`** — change the hint text:

```tsx
      <Text color="gray">↑↓ move ⏎ copy ⌃O add ⎋ quit ⌥⌫/⌃W del ⌃U clear ({resultCount})</Text>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tui-components`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/Footer.tsx tests/tui-components.test.tsx
git commit -m "feat(tui): footer hints at the ⌃O add binding"
```

---

## Task 13: In-TUI add (modal) in `App.tsx`

**Files:**
- Modify: `src/tui/App.tsx`
- Modify: `src/cli.ts` (pass `dataDir`)
- Modify: `tests/app.test.tsx`

- [ ] **Step 1: Write the failing tests** — append to the `describe("App", …)` block in `tests/app.test.tsx`

```tsx
import { tmpDataDir } from "./_helpers";
import { loadEntries } from "../src/data/loader";

it("opens the add form on ⌃O and search input goes inert", async () => {
  const dir = tmpDataDir({ "fork.yaml": "app: Fork\nentries:\n  - action: Pull\n    keys: \"⇧⌘L\"\n" });
  const { entries } = loadEntries(dir);
  const { lastFrame, stdin } = render(<App entries={entries} dataDir={dir} />);
  await tick();
  stdin.write("\x0f"); // ⌃O
  await tick();
  expect(lastFrame()).toContain("keybook add");
  stdin.write("zzz"); // would be a search query if search were active
  await tick();
  expect(lastFrame()).not.toContain("search: zzz");
});

it("returns to search on esc without writing", async () => {
  const dir = tmpDataDir({ "fork.yaml": "app: Fork\nentries:\n  - action: Pull\n    keys: \"⇧⌘L\"\n" });
  const { entries } = loadEntries(dir);
  const { lastFrame, stdin } = render(<App entries={entries} dataDir={dir} />);
  await tick();
  stdin.write("\x0f"); // ⌃O
  await tick();
  stdin.write("\x1b"); // esc
  await tick();
  expect(lastFrame()).toContain("search:");
});
```

> `⌃O` = `\x0f`. `render`, `App`, and `tick` are already imported at the top of `tests/app.test.tsx`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test app`
Expected: FAIL — `App` has no `dataDir`/`⌃O` behavior.

- [ ] **Step 3: Update `src/tui/App.tsx`**

Add imports:

```tsx
import { useCallback } from "react";
import { loadEntries } from "../data/loader";
import { addEntry, listApps } from "../data/writer";
import { AddEntryForm } from "./AddEntryForm";
import type { AddResult, EntryInput } from "../data/types";
```

Extend `AppProps` and state:

```tsx
export interface AppProps {
  entries: Entry[];
  errorCount?: number;
  dataDir?: string;
  onCopy?: (text: string) => boolean;
}

export function App({ entries: initial, errorCount = 0, dataDir, onCopy = copyToClipboard }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [entries, setEntries] = useState(initial);
  const [mode, setMode] = useState<"search" | "add">("search");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [flash, setFlash] = useState("");

  const reload = useCallback(() => {
    if (dataDir) setEntries(loadEntries(dataDir).entries);
  }, [dataDir]);
  // ...existing results/sel/current/listHeight/columnWidths...
```

> Rename the destructured prop from `entries` to `entries: initial`, and add `const [entries, setEntries] = useState(initial)` so the rest of the component (which already reads `entries`) is unchanged.

Gate the search handler and add the `⌃O` launch — change the `useInput(...)` call to pass `isActive` and add the launch branch near the top of the handler:

```tsx
  useInput(
    (input, key) => {
      if (!key.return && flash) setFlash("");
      if (key.escape || (key.ctrl && input === "c")) {
        exit();
        return;
      }
      if (dataDir && key.ctrl && input === "o") {
        setMode("add");
        return;
      }
      // ...all existing nav / edit / typing branches unchanged...
    },
    { isActive: mode === "search" },
  );
```

Add the modal render just before the existing `return (`:

```tsx
  if (mode === "add" && dataDir) {
    const existingTags = [...new Set(entries.flatMap((e) => e.tags ?? []))].sort();
    return (
      <AddEntryForm
        apps={listApps(dataDir)}
        existingTags={existingTags}
        onSubmit={(app: string, entry: EntryInput): AddResult => addEntry(dataDir, app, entry)}
        onComplete={(result: AddResult) => {
          if (result.ok) {
            reload();
            setSelected(0);
            setFlash(result.lines[0] ?? "✓ added");
          }
          setMode("search");
        }}
        onCancel={() => setMode("search")}
      />
    );
  }
```

- [ ] **Step 4: Pass `dataDir` from `src/cli.ts`** — in the default (TUI) action, change the render call:

```ts
  render(createElement(App, { entries, errorCount: errors.length, dataDir: dir }));
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test app`
Expected: PASS (existing App tests + the two new ones).

- [ ] **Step 6: Commit**

```bash
git add src/tui/App.tsx src/cli.ts tests/app.test.tsx
git commit -m "feat(tui): in-TUI add via ⌃O (modal render + reload on save)"
```

---

## Task 14: Document `keybook add` in the README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the Usage section** — change the command list and add a short paragraph

```markdown
keybook          # launch the TUI (alias: kb)
keybook add      # add a new entry (interactive form)
keybook path     # print the data directory
keybook edit     # open the data directory in $EDITOR
keybook check    # validate your data files
```

And under the TUI description, add:

```markdown
Press `⌃O` in the TUI to add an entry without leaving the search screen. Or
script it: `keybook add --app Fork --action 'Push' --keys 'shift cmd p' --tags push`
(`--keys` accepts glyphs or words; recipes use repeatable `--step`).
```

- [ ] **Step 2: Verify lint**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document keybook add (interactive, ⌃O, and flag mode)"
```

---

## Task 15: Final verification gate

**Files:** none (verification only).

- [ ] **Step 1: Full gate**

Run: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all green; `dist/cli.js` built with the shebang.

- [ ] **Step 2: End-to-end flag add against a temp dir**

```bash
D=$(mktemp -d)
node dist/cli.js add --app Fork --action 'Push the branch' --keys 'shift cmd p' --tags push
KEYBOOK_DATA_DIR=$D node dist/cli.js add --app Fork --action 'Push the branch' --keys 'shift cmd p'
KEYBOOK_DATA_DIR=$D node dist/cli.js check   # expect: ✓ N entries OK
```
Expected: the second command writes `fork.yaml` under `$D`; `check` passes.

- [ ] **Step 3: Manual interactive smoke**

Run: `KEYBOOK_DATA_DIR=$(mktemp -d) node dist/cli.js add`
Confirm: pick/create an app, toggle types, type `shift cmd p` and see `⇧⌘P`, build a recipe step, reach review, confirm, see `✓`. Re-run `keybook` and search for the new entry. Inside the TUI press `⌃O`, add an entry, confirm it appears after save, and that `esc` returns to search.

- [ ] **Step 4: Confirm acceptance criteria**

Re-read the spec's §13 and tick each box against the tests/behaviors above. File any gap as a follow-up task.

---

## Self-Review (completed by plan author)

**1. Spec coverage:**
- §4 modules → Tasks 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 (one or more tasks per file).
- §5 write path (validate, resolve, Document append, new-file via `new Document`, safety-net restore, file-I/O, no auto-commit) → Tasks 2 + 3.
- §5.1 preservation contract (semantic, comments survive) → Task 3 test.
- §6 normalizer → Task 1.
- §7 form (pick-list own input, type toggle UI-only, append-only steps, validation gate, review) → Tasks 7–10.
- §8 entry points (standalone + modal `⌃O` + reload + esc) → Tasks 11 + 13.
- §9 flag mode (exit 0/1/2, normalization, TTY dispatch) → Task 5.
- §10 error handling → Tasks 2, 3, 5.
- §11 tests → every task is TDD; integration in Task 5; in-TUI in Task 13.
- §13 acceptance → Task 15.

**2. Placeholder scan:** The only "coming in Task 11" stub (Task 5) is intentional and explicitly replaced in Task 11; `void prefill;` marks a deliberately-unused prefill reserved for the deferred AI path. No TBD/TODO in shipped code.

**3. Type consistency:** `EntryInput`/`AddResult` defined in Task 2 (`types.ts`) and used identically in `writer.ts`, `commands.ts` (`AddDraft` → `CheckResult`), `useAddForm.ts`, `AddEntryForm.tsx`, `App.tsx`, `cli.ts`. `AddEntryForm` prop names (`apps`, `existingTags`, `onSubmit`, `onComplete`, `onCancel`) match between Tasks 10, 11, 13. `Draft` field names match between Tasks 7, 9, 10. `normalizeKeys`/`parseTags`/`validateDraft`/`draftToEntryInput` signatures match across tasks.
