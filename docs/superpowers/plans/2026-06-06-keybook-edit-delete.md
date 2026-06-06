# keybook Edit & Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-TUI editing (`⌃E`, pre-filled locked form) and deletion (`⌃X`, inline `y/n` confirm) of the selected search entry, closing keybook's CRUD loop.

**Architecture:** Extend the existing read/create seams — no new files, no new deps, no new CLI commands. The loader stamps each entry with its source file + original YAML index (`LoadedEntry`); the writer gains `editEntry`/`deleteEntry` on the existing comment-preserving `Document` AST + post-write safety net; the edit UI reuses `AddEntryForm`/`ReviewScreen`/`normalizeKeys` pre-filled with the app locked; `App` adds `edit` mode and a delete-confirm interception.

**Tech Stack:** TypeScript (strict, ESM), Ink (React for the terminal), `yaml@2.9.0` Document API, zod, Vitest + ink-testing-library, tsdown, biome. Node 22, pnpm.

**Spec:** `docs/superpowers/specs/2026-06-06-keybook-edit-delete-design.md` (yaml API behaviors verified empirically in spec §12; TUI flow adversarially reviewed).

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/data/types.ts` | modify | Add `LoadedEntry`; widen `LoadResult.entries` to `LoadedEntry[]`. |
| `src/data/loader.ts` | modify | Stamp `file` + original YAML `index` on each loaded entry. |
| `src/search.ts` | modify | Make `search` generic so it preserves `LoadedEntry`. |
| `src/data/writer.ts` | modify | Add `deleteEntry` and `editEntry` (drift guard + safety net). |
| `src/tui/useAddForm.ts` | modify | `useAddForm(initial?: Partial<Draft>)` + pure `entryToDraft`. |
| `src/tui/FormFields.tsx` | modify | Render the app field locked when `lockedApp` is set. |
| `src/tui/AddEntryForm.tsx` | modify | `initial` / `lockedApp` / `title` props + locked focus model. |
| `src/tui/Footer.tsx` | modify | `confirm` prop (question left, fixed `y / n` right) + edit/delete hints. |
| `src/tui/App.tsx` | modify | `edit` mode, `editTarget`/`pendingDelete`, `⌃C`-first / `⌃E` / `⌃X` handlers. |
| Test files | modify | One test file per source file above, following existing conventions. |

**Dependency order:** Task 1 (provenance) → 2 (delete) → 3 (edit) → 4 (form hook) → 5 (FormFields) → 6 (AddEntryForm) → 7 (Footer) → 8 (App edit) → 9 (App delete) → 10 (verify).

**Commit convention (project rule):** plain messages, **no `Co-Authored-By` / Claude attribution trailer**.

**Running a single test file:** `pnpm test <path>`; a single test: `pnpm test <path> -t "<name>"`. Vitest runs via esbuild (no type-check at run time), so importing a not-yet-exported symbol yields `undefined` and calling it throws `TypeError: X is not a function` — that is the expected "red" for a new function.

---

## Task 1: Entry provenance (`LoadedEntry`, loader stamping, generic search)

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/data/loader.ts:9`, `src/data/loader.ts:61`
- Modify: `src/search.ts:11`
- Test: `tests/loader.test.ts`, `tests/search.test.ts`

- [ ] **Step 1: Write the failing loader skew test**

Add to `tests/loader.test.ts` inside `describe("loadEntries", ...)`:

```ts
it("stamps file and the ORIGINAL YAML index, even past an invalid entry", () => {
  const dir = tmpDataDir({
    "x.yaml":
      'app: X\nentries:\n' +
      '  - action: A\n    keys: "1"\n' +
      "  - action: Bad\n" + // invalid: no keys/steps/command -> skipped, YAML index 1
      '  - action: C\n    keys: "3"\n',
  });
  const { entries } = loadEntries(dir);
  expect(entries.map((e) => [e.action, e.file, e.index])).toEqual([
    ["A", "x.yaml", 0],
    ["C", "x.yaml", 2], // index 2, NOT the post-filter position 1
  ]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test tests/loader.test.ts -t "ORIGINAL YAML index"`
Expected: FAIL — `e.file`/`e.index` are `undefined` (loader does not stamp them yet).

- [ ] **Step 3: Add the `LoadedEntry` type**

In `src/data/types.ts`, add immediately after the `Entry` interface (before `LoadError`):

```ts
export interface LoadedEntry extends Entry {
  file: string; // basename of the source file, e.g. "fork.yaml"
  index: number; // original position in the file's `entries:` array
}
```

Then change `LoadResult` to carry loaded entries:

```ts
export interface LoadResult {
  entries: LoadedEntry[];
  errors: LoadError[];
}
```

- [ ] **Step 4: Stamp `file` + `index` in the loader**

In `src/data/loader.ts`, update the import on line 5 to include the new type:

```ts
import type { LoadError, LoadResult, LoadedEntry } from "./types";
```

Change line 10 from `const entries: Entry[] = [];` to:

```ts
const entries: LoadedEntry[] = [];
```

Change the push on line 61 from `entries.push({ app, ...parsed.data });` to:

```ts
entries.push({ app, file, index: i, ...parsed.data });
```

(`file` is the basename already in scope from the `for (const file of files)` loop; `i` is the `forEach` counter — the YAML array index, not the push position.)

- [ ] **Step 5: Write the failing search-preservation test**

Add to `tests/search.test.ts`:

```ts
import type { LoadedEntry } from "../src/data/types";

it("preserves LoadedEntry provenance on results", () => {
  const e: LoadedEntry = { app: "X", action: "Open settings", keys: "⌘,", file: "x.yaml", index: 4 };
  const [r] = search([e], "settings");
  expect(r).toMatchObject({ file: "x.yaml", index: 4 });
});
```

- [ ] **Step 6: Run it — it fails to type-check / compile**

Run: `pnpm test tests/search.test.ts -t "preserves LoadedEntry"`
Expected: FAIL — current `search(entries: Entry[]): Entry[]` returns `Entry`, so at the type level `r.file` is rejected by the editor; at runtime the object still has the fields (refs pass through) so the assertion may pass, but the generic is needed for type safety. (If it passes at runtime, still do Step 7 for the type change and re-run.)

- [ ] **Step 7: Make `search` generic**

In `src/search.ts`, change the signature on line 11 from:

```ts
export function search(entries: Entry[], query: string): Entry[] {
```

to:

```ts
export function search<T extends Entry>(entries: T[], query: string): T[] {
```

No body change — `[...entries].sort(...)` and `fzf.find(q).map((r) => r.item)` both already return the element type.

- [ ] **Step 8: Run the full loader + search suites**

Run: `pnpm test tests/loader.test.ts tests/search.test.ts`
Expected: PASS (all, including the existing `toMatchObject`/length assertions, which tolerate the extra `file`/`index` fields).

- [ ] **Step 9: Commit**

```bash
git add src/data/types.ts src/data/loader.ts src/search.ts tests/loader.test.ts tests/search.test.ts
git commit -m "feat(data): stamp entries with source file + YAML index (LoadedEntry)"
```

---

## Task 2: `deleteEntry` writer

**Files:**
- Modify: `src/data/writer.ts` (imports + new export)
- Test: `tests/writer.test.ts`

- [ ] **Step 1: Write the failing delete tests**

Add to `tests/writer.test.ts`. First extend the imports on line 1 and line 5:

```ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { addEntry, deleteEntry, editEntry, listApps, resolveTargetFile } from "../src/data/writer";
```

Then append:

```ts
const TWO = `app: Fork
entries:
  - action: Pull
    keys: "⇧⌘L"
  # keep me
  - action: Push
    keys: "⇧⌘P"
`;

describe("deleteEntry", () => {
  it("removes the entry at index, preserving siblings and comments", () => {
    const dir = tmpDataDir({ "fork.yaml": TWO });
    const res = deleteEntry(dir, "fork.yaml", 0, "Pull");
    expect(res.ok).toBe(true);
    const text = readFileSync(join(dir, "fork.yaml"), "utf8");
    expect(text).toContain("# keep me");
    const { entries, errors } = loadEntries(dir);
    expect(errors).toEqual([]);
    expect(entries.map((e) => e.action)).toEqual(["Push"]);
  });

  it("unlinks the file when the last entry is deleted", () => {
    const dir = tmpDataDir({ "solo.yaml": 'app: Solo\nentries:\n  - action: Only\n    keys: "A"\n' });
    const res = deleteEntry(dir, "solo.yaml", 0, "Only");
    expect(res.ok).toBe(true);
    expect(existsSync(join(dir, "solo.yaml"))).toBe(false);
    expect(loadEntries(dir).errors).toEqual([]);
  });

  it("aborts on drift (expectedAction mismatch) without writing", () => {
    const dir = tmpDataDir({ "fork.yaml": TWO });
    const before = readFileSync(join(dir, "fork.yaml"), "utf8");
    const res = deleteEntry(dir, "fork.yaml", 0, "Nope");
    expect(res.ok).toBe(false);
    expect(res.lines.join(" ")).toMatch(/changed on disk/);
    expect(readFileSync(join(dir, "fork.yaml"), "utf8")).toBe(before);
  });

  it("returns an error for a missing file", () => {
    const dir = tmpDataDir({});
    expect(deleteEntry(dir, "nope.yaml", 0, "X").ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/writer.test.ts -t "deleteEntry"`
Expected: FAIL — `TypeError: deleteEntry is not a function`.

- [ ] **Step 3: Implement `deleteEntry`**

In `src/data/writer.ts`, change the `yaml` import on line 10 to:

```ts
import { Document, isMap, isSeq, parseDocument } from "yaml";
```

Append this function to the file:

```ts
export function deleteEntry(
  dir: string,
  file: string,
  index: number,
  expectedAction: string,
): AddResult {
  const path = join(dir, file);
  let original: string;
  try {
    original = readFileSync(path, "utf8");
  } catch (e) {
    return err(path, [(e as Error).message]);
  }

  const doc = parseDocument(original);
  const node = doc.getIn(["entries", index]);
  const action = isMap(node) ? String(node.get("action") ?? "").trim() : undefined;
  if (action !== expectedAction.trim()) {
    return err(path, ["✗ entry changed on disk — reload and retry"]);
  }

  doc.deleteIn(["entries", index]);
  const seq = doc.getIn(["entries"]);
  const emptied = isSeq(seq) ? seq.items.length === 0 : true;

  try {
    if (emptied) unlinkSync(path);
    else writeFileSync(path, doc.toString());
  } catch (e) {
    return err(path, [(e as Error).message]);
  }

  // Safety net only matters on the write branch (after an unlink there is no file).
  if (!emptied) {
    const fileErr = loadEntries(dir).errors.find((e) => e.file === basename(file));
    if (fileErr) {
      writeFileSync(path, original);
      return err(path, [`✗ ${fileErr.message}`]);
    }
  }

  return {
    ok: true,
    file: path,
    created: false,
    lines: [
      emptied
        ? `✗ deleted '${expectedAction}' (removed empty ${basename(file)})`
        : `✗ deleted '${expectedAction}'`,
    ],
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test tests/writer.test.ts -t "deleteEntry"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/writer.ts tests/writer.test.ts
git commit -m "feat(data): add deleteEntry (drift guard, unlink-on-empty, safety net)"
```

---

## Task 3: `editEntry` writer

**Files:**
- Modify: `src/data/writer.ts` (new export)
- Test: `tests/writer.test.ts`

- [ ] **Step 1: Write the failing edit tests**

Append to `tests/writer.test.ts` (the `editEntry` import was already added in Task 2):

```ts
describe("editEntry", () => {
  const PAIR = `app: Fork
entries:
  - action: Pull
    keys: "⇧⌘L"
  # second
  - action: Push
    keys: "⇧⌘P"
`;

  it("replaces the entry in place, preserving siblings and comments", () => {
    const dir = tmpDataDir({ "fork.yaml": PAIR });
    const res = editEntry(dir, "fork.yaml", 0, { action: "Pull (rebase)", keys: "⇧⌘L" }, "Pull");
    expect(res.ok).toBe(true);
    const text = readFileSync(join(dir, "fork.yaml"), "utf8");
    expect(text).toContain("# second");
    const { entries, errors } = loadEntries(dir);
    expect(errors).toEqual([]);
    expect(entries.map((e) => e.action)).toEqual(["Pull (rebase)", "Push"]);
    expect(entries.find((e) => e.action === "Push")?.keys).toBe("⇧⌘P");
  });

  it("rejects an invalid edit (no body) without writing", () => {
    const dir = tmpDataDir({ "fork.yaml": PAIR });
    const before = readFileSync(join(dir, "fork.yaml"), "utf8");
    const res = editEntry(dir, "fork.yaml", 0, { action: "Empty" }, "Pull");
    expect(res.ok).toBe(false);
    expect(readFileSync(join(dir, "fork.yaml"), "utf8")).toBe(before);
  });

  it("aborts on drift", () => {
    const dir = tmpDataDir({ "fork.yaml": PAIR });
    const res = editEntry(dir, "fork.yaml", 0, { action: "X", keys: "A" }, "Wrong");
    expect(res.ok).toBe(false);
    expect(res.lines.join(" ")).toMatch(/changed on disk/);
  });

  it("rejects a stray app field", () => {
    const dir = tmpDataDir({ "fork.yaml": PAIR });
    const res = editEntry(
      dir, "fork.yaml", 0, { action: "X", keys: "A", app: "Fork" } as never, "Pull",
    );
    expect(res.ok).toBe(false);
    expect(res.lines.join(" ")).toMatch(/must not have an app field/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/writer.test.ts -t "editEntry"`
Expected: FAIL — `TypeError: editEntry is not a function`.

- [ ] **Step 3: Implement `editEntry`**

Append to `src/data/writer.ts`:

```ts
export function editEntry(
  dir: string,
  file: string,
  index: number,
  entry: EntryInput,
  expectedAction: string,
): AddResult {
  if ("app" in entry) {
    return err("", ["Error: entry must not have an app field; use --app instead"]);
  }
  const parsed = entrySchema.safeParse(entry);
  if (!parsed.success) {
    return err(
      "",
      parsed.error.issues.map((i) => i.message),
    );
  }
  const clean = buildClean(parsed.data);

  const path = join(dir, file);
  let original: string;
  try {
    original = readFileSync(path, "utf8");
  } catch (e) {
    return err(path, [(e as Error).message]);
  }

  const doc = parseDocument(original);
  const node = doc.getIn(["entries", index]);
  const action = isMap(node) ? String(node.get("action") ?? "").trim() : undefined;
  if (action !== expectedAction.trim()) {
    return err(path, ["✗ entry changed on disk — reload and retry"]);
  }

  doc.setIn(["entries", index], doc.createNode(clean));

  try {
    writeFileSync(path, doc.toString());
  } catch (e) {
    return err(path, [(e as Error).message]);
  }

  const fileErr = loadEntries(dir).errors.find((e) => e.file === basename(file));
  if (fileErr) {
    writeFileSync(path, original);
    return err(path, [`✗ ${fileErr.message}`]);
  }

  return { ok: true, file: path, created: false, lines: [`✓ updated '${clean.action}'`] };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test tests/writer.test.ts`
Expected: PASS (all writer tests, including the existing add ones).

- [ ] **Step 5: Commit**

```bash
git add src/data/writer.ts tests/writer.test.ts
git commit -m "feat(data): add editEntry (validate, replace-in-place, safety net)"
```

---

## Task 4: `useAddForm(initial?)` + `entryToDraft`

**Files:**
- Modify: `src/tui/useAddForm.ts:77-81` (hook signature), append `entryToDraft`
- Test: `tests/useAddForm.test.ts`

- [ ] **Step 1: Write the failing `entryToDraft` tests**

Add to `tests/useAddForm.test.ts`. Extend the import on line 2 to include `entryToDraft`:

```ts
import {
  type Draft,
  draftToEntryInput,
  emptyDraft,
  entryToDraft,
  parseTags,
  resolvedApp,
  validateDraft,
} from "../src/tui/useAddForm";
```

Append:

```ts
describe("entryToDraft", () => {
  it("round-trips a shortcut through draftToEntryInput", () => {
    const e = { action: "Push", keys: "⇧⌘P", tags: ["push"] };
    expect(draftToEntryInput(entryToDraft("Fork", e))).toEqual(e);
  });
  it("round-trips a command entry", () => {
    const e = { action: "Open", command: "open ." };
    expect(draftToEntryInput(entryToDraft("Terminal", e))).toEqual(e);
  });
  it("round-trips a recipe entry", () => {
    const e = { action: "Steps", steps: ["a", "b"], notes: "careful" };
    expect(draftToEntryInput(entryToDraft("X", e))).toEqual(e);
  });
  it("preserves an entry that has BOTH keys and command", () => {
    const e = { action: "Both", keys: "⌘K", command: "clear" };
    expect(draftToEntryInput(entryToDraft("X", e))).toEqual(e);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/useAddForm.test.ts -t "entryToDraft"`
Expected: FAIL — `entryToDraft` is `undefined` → `TypeError`.

- [ ] **Step 3: Implement `entryToDraft` and the new hook signature**

In `src/tui/useAddForm.ts`, append `entryToDraft` (above the `useAddForm` hook):

```ts
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
```

Replace the `useAddForm` hook (lines 77-81) with the `Partial<Draft>` form:

```ts
export function useAddForm(initial: Partial<Draft> = {}) {
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft, ...initial }));
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  return { draft, update, setDraft };
}
```

(`EntryInput` is already imported on line 3; `EntryType` is defined on line 5.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test tests/useAddForm.test.ts`
Expected: PASS (all). Note: `entryToDraft` accepts a `LoadedEntry` too — `LoadedEntry` is structurally a superset of `EntryInput`, so passing one is type-safe.

- [ ] **Step 5: Commit**

```bash
git add src/tui/useAddForm.ts tests/useAddForm.test.ts
git commit -m "feat(tui): useAddForm(initial?) + entryToDraft for edit pre-fill"
```

---

## Task 5: `FormFields` locked-app rendering

**Files:**
- Modify: `src/tui/FormFields.tsx`
- Test: `tests/form-views.test.tsx`

- [ ] **Step 1: Write the failing locked-field test**

Add to `tests/form-views.test.tsx` inside `describe("FormFields", ...)`:

```ts
it("renders the app field locked (no picker) when lockedApp is set", () => {
  const draft = { ...emptyDraft, app: "Fork", type: "shortcut" as const };
  const { lastFrame } = render(
    <FormFields draft={draft} apps={["Fork", "Zed"]} appIndex={0} focused={1} lockedApp="Fork" />,
  );
  const out = lastFrame() ?? "";
  expect(out).toContain("(locked)");
  expect(out).not.toContain("Create new app");
  expect(out).not.toContain("(↑/↓)");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/form-views.test.tsx -t "locked"`
Expected: FAIL — `lockedApp` is ignored; output lacks "(locked)".

- [ ] **Step 3: Add the `lockedApp` prop and locked render**

In `src/tui/FormFields.tsx`, add `lockedApp` to the prop list and its type:

```ts
export function FormFields({
  draft,
  apps,
  appIndex,
  focused,
  existingTags,
  lockedApp,
}: {
  draft: Draft;
  apps: string[];
  appIndex: number;
  focused: number;
  existingTags?: string[];
  lockedApp?: string;
}) {
```

Replace the `{/* 0: app */}` `<Box>...</Box>` block (currently lines 35-48) with a version that short-circuits when locked:

```tsx
      {/* 0: app */}
      <Box>
        <Text color={focused === 0 ? "cyan" : "gray"}>{"App".padEnd(8)}</Text>
        {lockedApp ? (
          <Text color="gray">{`${lockedApp}  (locked)`}</Text>
        ) : draft.creatingApp ? (
          <>
            <Text>{draft.newApp}</Text>
            {focused === 0 ? <Text inverse> </Text> : null}
          </>
        ) : (
          <Text>
            {appChoices[appIndex] ?? "—"}
            {focused === 0 ? "  (↑/↓)" : ""}
          </Text>
        )}
      </Box>
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test tests/form-views.test.tsx`
Expected: PASS (all, including the existing glyph-preview and tags-hint tests).

- [ ] **Step 5: Commit**

```bash
git add src/tui/FormFields.tsx tests/form-views.test.tsx
git commit -m "feat(tui): render the app field locked in FormFields"
```

---

## Task 6: `AddEntryForm` edit mode (`initial` / `lockedApp` / `title`)

**Files:**
- Modify: `src/tui/AddEntryForm.tsx`
- Test: `tests/add-form.test.tsx`

- [ ] **Step 1: Write the failing edit-mode tests**

Add to `tests/add-form.test.tsx`. Extend the import on line 4 area to include `entryToDraft`:

```ts
import { AddEntryForm } from "../src/tui/AddEntryForm";
import { entryToDraft } from "../src/tui/useAddForm";
```

Append inside `describe("AddEntryForm", ...)`:

```ts
it("pre-fills and locks the app in edit mode", async () => {
  const initial = entryToDraft("Fork", { action: "Push", keys: "⇧⌘P" });
  const { lastFrame } = render(
    <AddEntryForm
      apps={["Fork", "Zed"]}
      lockedApp="Fork"
      initial={initial}
      title="Edit entry — Fork"
      onSubmit={vi.fn(() => ok)}
      onComplete={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  await tick();
  const out = lastFrame() ?? "";
  expect(out).toContain("Edit entry — Fork");
  expect(out).toContain("(locked)");
  expect(out).toContain("Push");
  expect(out).toContain("⇧⌘P");
});

it("submits the locked app and edited action on confirm", async () => {
  const onSubmit = vi.fn(() => ok);
  const initial = entryToDraft("Fork", { action: "Push", keys: "⇧⌘P" });
  const { stdin } = render(
    <AddEntryForm
      apps={["Fork"]}
      lockedApp="Fork"
      initial={initial}
      onSubmit={onSubmit}
      onComplete={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  await tick();
  stdin.write("\x0e"); // ⌃N: Type(1) -> Action(2)
  await tick();
  stdin.write(" (force)"); // append to the pre-filled "Push"
  await tick();
  stdin.write("\r"); // review
  await tick();
  stdin.write("\r"); // confirm
  await tick();
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit).toHaveBeenCalledWith(
    "Fork",
    expect.objectContaining({ action: "Push (force)", keys: "⇧⌘P" }),
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/add-form.test.tsx -t "edit mode"`
Expected: FAIL — `AddEntryForm` ignores `initial`/`lockedApp`/`title`; "Edit entry" / "(locked)" / pre-filled "Push" absent.

- [ ] **Step 3: Add the three props and the locked focus model**

In `src/tui/AddEntryForm.tsx`:

(a) Extend `AddEntryFormProps` (after `resolveTarget`):

```ts
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
```

(b) Destructure them in the component signature (line 28-35) — add `initial`, `lockedApp`, `title`:

```ts
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
```

(c) Seed the form from `initial` when present (line 38):

```ts
  const { draft, update, setDraft } = useAddForm(initial ?? { app: apps[0] ?? "" });
  const [focused, setFocused] = useState(lockedApp ? 1 : 0);
```

(d) Floor the `⌃P` handler at the first editable field when locked (line 86):

```ts
    if (key.ctrl && input === "p") return setFocused((f) => Math.max(f - 1, lockedApp ? 1 : 0));
```

(e) Pass `lockedApp` to `FormFields` (inside the returned JSX, line 174-180):

```tsx
        <FormFields
          draft={draft}
          apps={apps}
          appIndex={appIndex}
          focused={focused}
          existingTags={existingTags}
          lockedApp={lockedApp}
        />
```

(f) Use `title` for the header (line 172):

```tsx
      <Text color="cyan">{title ?? "keybook add"}</Text>
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test tests/add-form.test.tsx`
Expected: PASS (all, including the existing add-mode tests — `lockedApp`/`initial`/`title` are optional and default to the old behavior).

- [ ] **Step 5: Commit**

```bash
git add src/tui/AddEntryForm.tsx tests/add-form.test.tsx
git commit -m "feat(tui): edit mode for AddEntryForm (prefilled, app locked, title)"
```

---

## Task 7: `Footer` confirm prompt + edit/delete hints

**Files:**
- Modify: `src/tui/Footer.tsx`
- Test: `tests/tui-components.test.tsx`

- [ ] **Step 1: Update the Footer tests**

In `tests/tui-components.test.tsx`, **replace** the existing test `"hints at word-back delete and clear-query bindings"` (lines 62-67) with these three tests (the word-delete keys still function; only the always-on hint changes to make room for edit/delete):

```ts
it("hints at the clear-query binding", () => {
  const { lastFrame } = render(<Footer flash="" errorCount={0} resultCount={5} />);
  expect(lastFrame() ?? "").toContain("⌃U");
});
it("hints at the edit and delete bindings", () => {
  const { lastFrame } = render(<Footer flash="" errorCount={0} resultCount={5} />);
  const f = lastFrame() ?? "";
  expect(f).toContain("⌃E");
  expect(f).toContain("⌃X");
});
it("shows the delete confirm prompt with a visible y / n", () => {
  const { lastFrame } = render(
    <Footer flash="" errorCount={0} resultCount={3} confirm="Delete 'Fork: Push'?" />,
  );
  const f = lastFrame() ?? "";
  expect(f).toContain("Delete 'Fork: Push'?");
  expect(f).toContain("y / n");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/tui-components.test.tsx -t "Footer"`
Expected: FAIL — no `⌃E`/`⌃X` in the hint; `confirm` prop ignored so no "y / n".

- [ ] **Step 3: Implement the `confirm` prop and new hint**

Replace the entire body of `src/tui/Footer.tsx` with:

```tsx
import { Box, Text } from "ink";

export function Footer({
  flash,
  errorCount,
  resultCount,
  confirm,
}: {
  flash: string;
  errorCount: number;
  resultCount: number;
  confirm?: string;
}) {
  // wrap="truncate-end" keeps the line within the frame even when wide-glyph
  // keycaps (⌘⌥⌃⇧⏎⎋⌫) render as 2 cells. A wrapped line overflows the height
  // and Ink's in-place redraw breaks (commit 66200d9). The confirm question
  // truncates on the left; the y / n lives in the fixed right cell so it is
  // always visible.
  if (confirm) {
    return (
      <Box marginTop={1} justifyContent="space-between">
        <Text color="yellow" wrap="truncate-end">
          {confirm}
        </Text>
        <Text color="yellow" bold>
          {"  y / n"}
        </Text>
      </Box>
    );
  }
  return (
    <Box marginTop={1} justifyContent="space-between">
      <Text color="gray" wrap="truncate-end">
        ↑↓ move ⏎ copy ⌃O add ⌃E edit ⌃X del ⎋ quit ⌃U clear ({resultCount})
      </Text>
      {flash ? (
        <Text color="green">{flash}</Text>
      ) : errorCount > 0 ? (
        <Text color="yellow">⚠ {errorCount} skipped — run `keybook check`</Text>
      ) : (
        <Text> </Text>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test tests/tui-components.test.tsx`
Expected: PASS (all). The existing `"hints at the add binding"` test (`⌃O`) still passes.

- [ ] **Step 5: Commit**

```bash
git add src/tui/Footer.tsx tests/tui-components.test.tsx
git commit -m "feat(tui): footer delete-confirm prompt + edit/delete hints"
```

---

## Task 8: `App` edit wiring (`edit` mode, `⌃E`)

**Files:**
- Modify: `src/tui/App.tsx`
- Test: `tests/app.test.tsx`

- [ ] **Step 1: Update the App test fixture to `LoadedEntry[]` and add the edit test**

In `tests/app.test.tsx`, change the import on line 4 and the fixture type on line 8 so the hand-built entries carry provenance (required now that `App` holds `LoadedEntry[]`):

```ts
import type { LoadedEntry } from "../src/data/types";

const entries: LoadedEntry[] = [
  { app: "Finder", action: "Open a new tab", keys: "⌘T", tags: ["new tab"], file: "finder.yaml", index: 0 },
  { app: "Terminal", action: "Clear screen", keys: "⌘K", file: "terminal.yaml", index: 0 },
  {
    app: "Finder",
    action: "Open Terminal here",
    steps: ["Right-click"],
    command: 'open -a Terminal "$PWD"',
    file: "finder.yaml",
    index: 1,
  },
];
```

Append a new test inside `describe("App", ...)`:

```ts
it("edits the selected entry on ⌃E and reflects the change after reload", async () => {
  const dir = tmpDataDir({
    "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
  });
  const { entries } = loadEntries(dir);
  const { lastFrame, stdin } = render(<App entries={entries} dataDir={dir} />);
  await tick();
  stdin.write("\x05"); // ⌃E -> edit form (only entry "Pull" is selected)
  await tick();
  expect(lastFrame()).toContain("Edit entry");
  expect(lastFrame()).toContain("Pull");
  stdin.write("\x0e"); // ⌃N: Type -> Action
  await tick();
  stdin.write(" (rebase)");
  await tick();
  stdin.write("\r"); // review
  await tick();
  stdin.write("\r"); // confirm -> editEntry + reload + flash
  await tick();
  const out = lastFrame() ?? "";
  expect(out).toContain("Pull (rebase)");
  expect(out).toContain("✓");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/app.test.tsx -t "edits the selected entry"`
Expected: FAIL — `⌃E` does nothing; no "Edit entry" screen.

- [ ] **Step 3: Wire edit mode into `App`**

In `src/tui/App.tsx`:

(a) Extend the imports on lines 5-6:

```ts
import type { AddResult, Entry, EntryInput, LoadedEntry } from "../data/types";
import { addEntry, editEntry, listApps, resolveTargetFile } from "../data/writer";
```

and add `entryToDraft` to the `useAddForm` import area — add this import near the other tui imports:

```ts
import { entryToDraft } from "./useAddForm";
```

(b) Change `AppProps.entries` (line 17) to `LoadedEntry[]`:

```ts
export interface AppProps {
  entries: LoadedEntry[];
  errorCount?: number;
  dataDir?: string;
  onCopy?: (text: string) => boolean;
}
```

(c) Change the `mode` state and add `editTarget` (lines 31-32):

```ts
  const [entries, setEntries] = useState(initial);
  const [mode, setMode] = useState<"search" | "add" | "edit">("search");
  const [editTarget, setEditTarget] = useState<LoadedEntry | null>(null);
```

(d) Add a `⌃E` branch to the search `useInput`, right after the `⌃O` branch (after line 58):

```ts
      if (dataDir && current && key.ctrl && input === "e") {
        setEditTarget(current);
        setMode("edit");
        return;
      }
```

(e) Hoist `existingTags` above the modal render and add the `edit` render block. Replace the `if (mode === "add" && dataDir) { ... }` block (lines 97-116) with:

```tsx
  const existingTags = [...new Set(entries.flatMap((e) => e.tags ?? []))].sort();

  if (mode === "add" && dataDir) {
    return (
      <AddEntryForm
        apps={listApps(dataDir)}
        existingTags={existingTags}
        resolveTarget={(a: string) => resolveTargetFile(dataDir, a)}
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

  if (mode === "edit" && dataDir && editTarget) {
    return (
      <AddEntryForm
        apps={listApps(dataDir)}
        existingTags={existingTags}
        lockedApp={editTarget.app}
        initial={entryToDraft(editTarget.app, editTarget)}
        title={`Edit entry — ${editTarget.app}`}
        resolveTarget={(a: string) => resolveTargetFile(dataDir, a)}
        onSubmit={(_app: string, entry: EntryInput): AddResult =>
          editEntry(dataDir, editTarget.file, editTarget.index, entry, editTarget.action)
        }
        onComplete={(result: AddResult) => {
          if (result.ok) {
            reload();
            setSelected(0);
            setFlash(result.lines[0] ?? "✓ updated");
          }
          setMode("search");
          setEditTarget(null);
        }}
        onCancel={() => {
          setMode("search");
          setEditTarget(null);
        }}
      />
    );
  }
```

(Note: the previous `existingTags` declaration that lived *inside* the add block is now removed — it is declared once above.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test tests/app.test.tsx`
Expected: PASS (all — the existing search/copy/add tests still pass with the `LoadedEntry[]` fixture).

- [ ] **Step 5: Commit**

```bash
git add src/tui/App.tsx tests/app.test.tsx
git commit -m "feat(tui): ⌃E opens the prefilled edit form and saves in place"
```

---

## Task 9: `App` delete wiring (`⌃X`, confirm interception, `⌃C`-first)

**Files:**
- Modify: `src/tui/App.tsx`
- Test: `tests/app.test.tsx`

- [ ] **Step 1: Write the failing delete tests**

Append to `tests/app.test.tsx` inside `describe("App", ...)`:

```ts
it("deletes the selected entry on ⌃X then y, leaving the sibling", async () => {
  const dir = tmpDataDir({
    "fork.yaml":
      'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n  - action: Push\n    keys: "⇧⌘P"\n',
  });
  const { entries } = loadEntries(dir);
  const { lastFrame, stdin } = render(<App entries={entries} dataDir={dir} />);
  await tick();
  // Browse order sorts by app then action: "Pull" < "Push", so index 0 = Pull.
  stdin.write("\x18"); // ⌃X -> arm confirm
  await tick();
  expect(lastFrame()).toContain("Delete 'Fork: Pull'?");
  expect(lastFrame()).toContain("y / n");
  stdin.write("y"); // confirm
  await tick();
  const out = lastFrame() ?? "";
  // The success flash ("✗ deleted 'Pull'") echoes the word "Pull", so assert on
  // the deleted entry's KEYS (⇧⌘L only ever appeared on the Pull row) instead.
  expect(out).not.toContain("⇧⌘L");
  expect(out).toContain("Push");
  expect(out).toContain("✗ deleted");
});

it("cancels the delete on any other key", async () => {
  const dir = tmpDataDir({
    "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
  });
  const { entries } = loadEntries(dir);
  const { lastFrame, stdin } = render(<App entries={entries} dataDir={dir} />);
  await tick();
  stdin.write("\x18"); // ⌃X
  await tick();
  stdin.write("n"); // cancel
  await tick();
  expect(lastFrame()).toContain("Pull");
  expect(lastFrame()).not.toContain("Delete 'Fork");
});

it("⌃E and ⌃X are no-ops when there are no results", async () => {
  const dir = tmpDataDir({
    "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
  });
  const { entries } = loadEntries(dir);
  const { lastFrame, stdin } = render(<App entries={entries} dataDir={dir} />);
  await tick();
  stdin.write("zzzzz"); // no matches
  await tick();
  expect(lastFrame()).toContain("No matches");
  stdin.write("\x05"); // ⌃E
  await tick();
  stdin.write("\x18"); // ⌃X
  await tick();
  expect(lastFrame()).not.toContain("Edit entry");
  expect(lastFrame()).not.toContain("Delete '");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/app.test.tsx -t "deletes the selected entry"`
Expected: FAIL — `⌃X` does nothing; no confirm prompt.

- [ ] **Step 3: Add `pendingDelete`, the confirm interception, `⌃C`-first, `⌃X`, and the Footer `confirm` prop**

In `src/tui/App.tsx`:

(a) Add `deleteEntry` to the writer import:

```ts
import { addEntry, deleteEntry, editEntry, listApps, resolveTargetFile } from "../data/writer";
```

(b) Add the `pendingDelete` state (after `editTarget`):

```ts
  const [pendingDelete, setPendingDelete] = useState<LoadedEntry | null>(null);
```

(c) Restructure the **top** of the search `useInput` callback. Replace the current first lines (the flash-clear on line 49 and the `escape`/`ctrl-c` quit on line 51) with this ordered prologue, then leave the rest of the handler unchanged:

```ts
    (input, key) => {
      // ⌃C always hard-quits, even while a delete is armed.
      if (key.ctrl && input === "c") {
        exit();
        return;
      }

      // Delete-confirm interception — before the esc branch so esc cancels the
      // pending delete instead of quitting. Manages flash itself (it returns early).
      if (pendingDelete) {
        const confirmKey = key.return || input === "y" || input === "Y";
        if (confirmKey && dataDir) {
          const r = deleteEntry(
            dataDir,
            pendingDelete.file,
            pendingDelete.index,
            pendingDelete.action.trim(),
          );
          if (r.ok) {
            reload();
            setSelected(0);
          }
          setFlash(r.lines[0] ?? (r.ok ? "✗ deleted" : "✗ delete failed"));
        } else {
          setFlash("");
        }
        setPendingDelete(null);
        return;
      }

      if (!key.return && flash) setFlash("");

      if (key.escape) {
        exit();
        return;
      }
```

(d) Add the `⌃X` branch right after the `⌃E` branch:

```ts
      if (dataDir && current && key.ctrl && input === "x") {
        setPendingDelete(current);
        return;
      }
```

(e) Pass the `confirm` prop to the `Footer` in the search render (the `<Footer .../>` line near the end):

```tsx
      <Footer
        flash={flash}
        errorCount={errorCount}
        resultCount={results.length}
        confirm={
          pendingDelete ? `Delete '${pendingDelete.app}: ${pendingDelete.action}'?` : undefined
        }
      />
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test tests/app.test.tsx`
Expected: PASS (all). The existing `esc`-quits-search behavior is unchanged (the `escape` branch still runs when no delete is armed).

- [ ] **Step 5: Commit**

```bash
git add src/tui/App.tsx tests/app.test.tsx
git commit -m "feat(tui): ⌃X inline delete-confirm; ⌃C hard-quits during confirm"
```

---

## Task 10: Full verification + real-terminal smoke

**Files:** none (verification gate). No code, no commit unless a doc update is made in Step 4.

- [ ] **Step 1: Run the entire suite + static checks**

Run:
```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```
Expected: all green — every test passes, `tsc --noEmit` clean, biome clean, `tsdown` produces `dist/cli.js`.

- [ ] **Step 2: Real-terminal smoke — edit an entry end-to-end**

Create `/tmp/kb-edit-smoke.py` with this content, then run `python3 /tmp/kb-edit-smoke.py` and read its assertions:

```python
import os, pty, time, subprocess, tempfile, sys

repo = subprocess.check_output(["git", "rev-parse", "--show-toplevel"]).decode().strip()
data = tempfile.mkdtemp(prefix="kb-smoke-")
with open(os.path.join(data, "fork.yaml"), "w") as f:
    f.write('app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n')

env = dict(os.environ, KEYBOOK_DATA_DIR=data)
cli = os.path.join(repo, "dist", "cli.js")

def send(fd, s, d=0.7):
    os.write(fd, s.encode()); time.sleep(d)

pid, fd = pty.fork()
if pid == 0:
    os.execvpe("node", ["node", cli], env)
time.sleep(1.2)
send(fd, "\x05")            # ⌃E -> edit
send(fd, "\x0e")            # ⌃N -> Action
send(fd, " (rebase)")       # append
send(fd, "\r")              # review
send(fd, "\r")              # confirm
time.sleep(0.8)
send(fd, "\x1b", 0.5)       # esc to quit
try:
    os.waitpid(pid, 0)
except Exception:
    pass

text = open(os.path.join(data, "fork.yaml")).read()
assert "Pull (rebase)" in text, f"edit did not persist:\n{text}"
check = subprocess.run(["node", cli, "check"], env=env, capture_output=True, text=True)
assert check.returncode == 0, f"check failed: {check.stdout}{check.stderr}"
print("EDIT SMOKE OK")
```
Expected: prints `EDIT SMOKE OK`.

- [ ] **Step 3: Real-terminal smoke — delete the last entry removes the file**

Create `/tmp/kb-del-smoke.py` with this content, then run `python3 /tmp/kb-del-smoke.py`:

```python
import os, pty, time, subprocess, tempfile

repo = subprocess.check_output(["git", "rev-parse", "--show-toplevel"]).decode().strip()
data = tempfile.mkdtemp(prefix="kb-smoke-")
solo = os.path.join(data, "solo.yaml")
with open(solo, "w") as f:
    f.write('app: Solo\nentries:\n  - action: Only thing\n    keys: "A"\n')

env = dict(os.environ, KEYBOOK_DATA_DIR=data)
cli = os.path.join(repo, "dist", "cli.js")

def send(fd, s, d=0.7):
    os.write(fd, s.encode()); time.sleep(d)

pid, fd = pty.fork()
if pid == 0:
    os.execvpe("node", ["node", cli], env)
time.sleep(1.2)
send(fd, "\x18")            # ⌃X -> arm confirm
send(fd, "y")               # confirm delete (last entry)
time.sleep(0.8)
send(fd, "\x1b", 0.5)       # esc quit
try:
    os.waitpid(pid, 0)
except Exception:
    pass

assert not os.path.exists(solo), "file should have been removed when last entry deleted"
check = subprocess.run(["node", cli, "check"], env=env, capture_output=True, text=True)
assert check.returncode == 0, f"check failed: {check.stdout}{check.stderr}"
print("DELETE SMOKE OK")
```
Expected: prints `DELETE SMOKE OK`. (PTY timing is environment-sensitive; if a keystroke is dropped, lengthen the `d` delays. The unit tests in Tasks 8-9 are the authoritative gate — the smoke confirms the real terminal.)

- [ ] **Step 4: (optional) Update user-facing docs**

If `README.md` enumerates the in-TUI key bindings, add `⌃E edit` and `⌃X delete` to that list to match the new footer. If you change the README:

```bash
git add README.md
git commit -m "docs: document ⌃E edit and ⌃X delete bindings"
```

If no doc change is needed, this task produces no commit.

- [ ] **Step 5: Clean up smoke scripts**

```bash
rm -f /tmp/kb-edit-smoke.py /tmp/kb-del-smoke.py
```

---

## Done criteria

- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` all green.
- `⌃E` edits the selected entry in place (app locked, pre-filled); `⌃X` deletes it behind an inline `y/n` confirm with a visible `y / n`; `⌃C` still hard-quits; deleting a file's last entry removes the file; `keybook check` passes throughout.
- No new runtime dependency, no new CLI command, no new module.
