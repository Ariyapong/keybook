# Editing Polish (recipe-step reorder + move-entry) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add grab-and-move recipe-step reorder (+ per-step delete) and move-an-entry-to-another-app (by unlocking the edit form's app field), both shipping as v0.7.0.

**Architecture:** Both features ride existing seams. Reorder is pure in-form React state over `Draft.steps`, written through the unchanged `draftToEntryInput → editEntry/addEntry/moveEntry` path. Move adds one writer function (`moveEntry`) that composes the already-verified `addEntry` (target, first) + `deleteEntry` (source), and unlocks the edit form's app field so changing it relocates the entry. No new deps, no schema change, no new CLI surface.

**Tech Stack:** TypeScript, Ink/React (TUI), `yaml@2.9.0` Document API, zod, Vitest + `ink-testing-library`, Biome, pnpm.

**Spec:** `docs/superpowers/specs/2026-06-20-editing-polish-design.md` (read it — this plan implements it after the adversarial-falsification corrections).

## Global Constraints

- **No new runtime dependencies.** Reorder is React state; move composes existing writer functions.
- **No schema change.** `entrySchema`/`fileShape` unchanged; `steps` stays `string[]`.
- **No new CLI surface / no new module.** Every change edits an existing file.
- **`keybook check` invariant:** no write may leave a file that fails `check` (inherited from `addEntry`/`deleteEntry` safety nets; assert `loadEntries(dir).errors` is `[]` after move).
- **Move ordering is load-bearing:** `addEntry` (target) FIRST, then `deleteEntry` (source). Never the reverse (would risk data loss).
- **Every branch of the field-3 recipe input block MUST `return`** — falling through reaches the generic text handler that maps recipe field-3 to `keys` and corrupts `draft.keys`.
- **Run commands without `--`** (pnpm 10 forwards a literal `--` and breaks arg parsing). Use `pnpm exec vitest run <file> -t "<name>"`.
- Commit style: Conventional Commits (`feat(tui): …`, `feat(data): …`). No co-author trailers.

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `src/tui/useAddForm.ts` | Pure step helpers `moveStep`/`deleteStep` | 1 |
| `src/tui/StepsBuilder.tsx` | Render step cursor (`>`) / grabbed (`⇅`) markers + dynamic hint | 2 |
| `src/data/writer.ts` | `moveEntry` (compose add+delete, defensive self-delete guard) | 3 |
| `src/tui/FormFields.tsx` | Drop `lockedApp` branch (app always a chooser); pass `stepCursor`/`grabbed` to `StepsBuilder` | 4, 5 |
| `src/tui/AddEntryForm.tsx` | `initialFocus` + seed `appIndex`; `stepCursor`/`grabbed` state + grab input logic; esc-grab intercept | 4, 5 |
| `src/tui/App.tsx` | Edit modal: `initialFocus`; route `editEntry` vs `moveEntry`; app-aware `resolveTarget` | 4, 6 |
| `tests/*` | Migrate 3 `lockedApp` tests; add reorder/move tests | 4, 5, 6 |

**Task order & dependencies:** 1 → 2 → 3 (independent) → 4 (unlock; touches FormFields/AddEntryForm/App) → 5 (reorder input; touches the same FormFields/AddEntryForm, so AFTER 4) → 6 (App routing; needs 3 + 4) → 7 (final gate).

---

### Task 1: Pure step helpers (`moveStep`, `deleteStep`)

**Files:**
- Modify: `src/tui/useAddForm.ts` (add two exported pure functions after `parseTags`)
- Test: `tests/useAddForm.test.ts` (append two `describe` blocks)

**Interfaces:**
- Produces: `moveStep(steps: string[], from: number, to: number): string[]` (returns a new array; no-op if out of range or `from === to`); `deleteStep(steps: string[], i: number): string[]` (returns a new array; no-op if out of range).

- [ ] **Step 1: Write the failing tests**

Append to `tests/useAddForm.test.ts` (and add `moveStep, deleteStep` to the existing import from `../src/tui/useAddForm`):

```ts
describe("moveStep", () => {
  it("moves a step up and down", () => {
    expect(moveStep(["a", "b", "c"], 1, 0)).toEqual(["b", "a", "c"]);
    expect(moveStep(["a", "b", "c"], 1, 2)).toEqual(["a", "c", "b"]);
  });
  it("moves across multiple positions", () => {
    expect(moveStep(["a", "b", "c", "d"], 0, 3)).toEqual(["b", "c", "d", "a"]);
  });
  it("is a no-op at the ends, for same index, and out of range", () => {
    expect(moveStep(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveStep(["a", "b"], 1, 2)).toEqual(["a", "b"]);
    expect(moveStep(["a", "b"], 0, 0)).toEqual(["a", "b"]);
  });
});

describe("deleteStep", () => {
  it("removes the step at the index", () => {
    expect(deleteStep(["a", "b", "c"], 1)).toEqual(["a", "c"]);
  });
  it("is a no-op for out-of-range indices", () => {
    expect(deleteStep(["a", "b"], 5)).toEqual(["a", "b"]);
    expect(deleteStep(["a", "b"], -1)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/useAddForm.test.ts -t "moveStep"`
Expected: FAIL — `moveStep is not a function` / import error.

- [ ] **Step 3: Implement the helpers**

Add to `src/tui/useAddForm.ts` (after `parseTags`):

```ts
/** Move the step at `from` to position `to`, returning a NEW array. No-op if out of range or from===to. */
export function moveStep(steps: string[], from: number, to: number): string[] {
  if (from < 0 || from >= steps.length || to < 0 || to >= steps.length || from === to) {
    return steps;
  }
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Remove the step at `i`, returning a NEW array. No-op if out of range. */
export function deleteStep(steps: string[], i: number): string[] {
  if (i < 0 || i >= steps.length) return steps;
  return steps.filter((_, idx) => idx !== i);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/useAddForm.test.ts`
Expected: PASS (all existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/tui/useAddForm.ts tests/useAddForm.test.ts
git commit -m "feat(tui): add moveStep/deleteStep pure helpers for recipe reorder"
```

---

### Task 2: `StepsBuilder` cursor & grabbed rendering

**Files:**
- Modify: `src/tui/StepsBuilder.tsx`
- Test: `tests/steps-builder.test.tsx` (add cases; existing two must still pass)

**Interfaces:**
- Consumes: nothing.
- Produces: `StepsBuilder` now accepts `cursor?: number` (default `steps.length` = append line) and `grabbed?: boolean` (default `false`). A step row `i` shows `"> "` when `active && cursor === i`, `"⇅ "` when also `grabbed`, else `"  "`. The append-line block-cursor renders only when `active && cursor === steps.length`. Hint is dynamic.

- [ ] **Step 1: Write the failing tests**

Append to `tests/steps-builder.test.tsx`:

```ts
it("marks the selected step and the grabbed step", () => {
  const sel = render(
    <StepsBuilder steps={["a", "b", "c"]} line="" active cursor={1} grabbed={false} />,
  );
  expect(sel.lastFrame() ?? "").toContain("> 2. b");
  const grab = render(<StepsBuilder steps={["a", "b", "c"]} line="" active cursor={1} grabbed />);
  expect(grab.lastFrame() ?? "").toContain("⇅ 2. b");
});

it("shows reorder hints when a step is selected vs grabbed", () => {
  const onStep = render(<StepsBuilder steps={["a", "b"]} line="" active cursor={0} />);
  expect(onStep.lastFrame() ?? "").toMatch(/grab/);
  const grabbed = render(<StepsBuilder steps={["a", "b"]} line="" active cursor={0} grabbed />);
  expect(grabbed.lastFrame() ?? "").toMatch(/drop/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/steps-builder.test.tsx -t "marks the selected step"`
Expected: FAIL — output lacks `> 2. b` (no markers rendered yet).

- [ ] **Step 3: Implement marker + dynamic hint rendering**

Replace the body of `src/tui/StepsBuilder.tsx` with:

```tsx
import { Box, Text } from "ink";

export function StepsBuilder({
  steps,
  line,
  active,
  cursor,
  grabbed = false,
}: {
  steps: string[];
  line: string;
  active: boolean;
  cursor?: number;
  grabbed?: boolean;
}) {
  const cur = cursor ?? steps.length; // default: the append line
  const onAppendLine = cur >= steps.length;
  const hint = grabbed
    ? "↑↓ move · Space/⏎ drop"
    : steps.length === 0
      ? "⏎ adds a step · ⌫ on an empty line removes the last"
      : onAppendLine
        ? "⏎ adds a step · ↑ select a step to reorder"
        : "↑↓ select · Space grab · ⌫ delete";

  return (
    <Box flexDirection="column">
      {steps.map((s, i) => {
        const marker = active && cur === i ? (grabbed ? "⇅ " : "> ") : "  ";
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: steps are an ordered list; duplicates allowed so value is not a unique key
          <Text key={i}>
            {marker}
            {i + 1}. {s}
          </Text>
        );
      })}
      <Box>
        <Text color={active && onAppendLine ? "cyan" : "gray"}>
          {"  "}
          {steps.length + 1}.{" "}
        </Text>
        <Text>{line}</Text>
        {active && onAppendLine ? <Text inverse> </Text> : null}
      </Box>
      {active ? <Text color="gray">{hint}</Text> : null}
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/steps-builder.test.tsx`
Expected: PASS — both new cases and the two existing cases (`renders numbered steps and the active line`; `shows a hint when there are no steps` — its `/⏎ adds a step/` still matches).

- [ ] **Step 5: Commit**

```bash
git add src/tui/StepsBuilder.tsx tests/steps-builder.test.tsx
git commit -m "feat(tui): render step cursor/grabbed markers and reorder hints in StepsBuilder"
```

---

### Task 3: `moveEntry` write path

**Files:**
- Modify: `src/data/writer.ts` (add `moveEntry` after `editEntry`)
- Test: `tests/writer.test.ts` (add a `describe("moveEntry")`; add `moveEntry` to the import)

**Interfaces:**
- Consumes: existing `addEntry`, `deleteEntry`, `editEntry`, `resolveTargetFile`, `join`.
- Produces: `moveEntry(dir: string, sourceFile: string, index: number, expectedAction: string, targetApp: string, entry: EntryInput): AddResult`. Returns `addRes` (ok:false) on a failed target add (source untouched); `{ok:true, …, lines:["⚠ moved …; original still in <source> — remove it manually"]}` when the source delete fails (both kept); `{ok:true, …, lines:["✓ moved '<action>' → <targetApp>"]}` on success; delegates to `editEntry` if the target resolves to the source file.

- [ ] **Step 1: Write the failing tests**

Add `moveEntry` to the writer import in `tests/writer.test.ts`:
```ts
import { addEntry, deleteEntry, editEntry, listApps, moveEntry, resolveTargetFile } from "../src/data/writer";
```
Append:

```ts
describe("moveEntry", () => {
  const FORK_PAIR = `app: Fork
entries:
  - action: Pull
    keys: "⇧⌘L"
  - action: Push
    keys: "⇧⌘P"
`;
  const GIT = 'app: Git\nentries:\n  - action: Status\n    keys: "g s"\n';

  it("moves an entry to an existing app and removes it from the source", () => {
    const dir = tmpDataDir({ "fork.yaml": FORK_PAIR, "git.yaml": GIT });
    const res = moveEntry(dir, "fork.yaml", 0, "Pull", "Git", { action: "Pull", keys: "⇧⌘L" });
    expect(res.ok).toBe(true);
    const { entries, errors } = loadEntries(dir);
    expect(errors).toEqual([]);
    const byApp = (a: string) => entries.filter((e) => e.app === a).map((e) => e.action);
    expect(byApp("Git")).toEqual(["Status", "Pull"]); // appended to target
    expect(byApp("Fork")).toEqual(["Push"]); // removed from source
  });

  it("moves to a brand-new app, creating the file and unlinking an emptied source", () => {
    const dir = tmpDataDir({ "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n' });
    const res = moveEntry(dir, "fork.yaml", 0, "Pull", "Slack", { action: "Pull", keys: "⇧⌘L" });
    expect(res.ok).toBe(true);
    expect(res.created).toBe(true);
    expect(existsSync(join(dir, "slack.yaml"))).toBe(true);
    expect(existsSync(join(dir, "fork.yaml"))).toBe(false); // source emptied -> unlinked
    expect(loadEntries(dir).errors).toEqual([]);
  });

  it("aborts with the source untouched when the target add is invalid", () => {
    const dir = tmpDataDir({ "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n', "git.yaml": GIT });
    const before = readFileSync(join(dir, "fork.yaml"), "utf8");
    const res = moveEntry(dir, "fork.yaml", 0, "Pull", "Git", { action: "Pull" }); // no body -> reject
    expect(res.ok).toBe(false);
    expect(readFileSync(join(dir, "fork.yaml"), "utf8")).toBe(before);
  });

  it("keeps both copies and warns when the source delete drifts", () => {
    const dir = tmpDataDir({ "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n', "git.yaml": GIT });
    const res = moveEntry(dir, "fork.yaml", 0, "WRONG", "Git", { action: "Pull", keys: "⇧⌘L" });
    expect(res.ok).toBe(true);
    expect(res.lines.join(" ")).toMatch(/still in/);
    expect(loadEntries(dir).entries.filter((e) => e.action === "Pull").length).toBe(2);
  });

  it("delegates to an in-place edit when the target resolves to the source file", () => {
    const dir = tmpDataDir({ "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n' });
    const res = moveEntry(dir, "fork.yaml", 0, "Pull", "fork", { action: "Pull (rebase)", keys: "⇧⌘L" });
    expect(res.ok).toBe(true);
    const { entries } = loadEntries(dir);
    expect(entries.map((e) => e.action)).toEqual(["Pull (rebase)"]); // edited in place, not duplicated
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/writer.test.ts -t "moveEntry"`
Expected: FAIL — `moveEntry is not a function`.

- [ ] **Step 3: Implement `moveEntry`**

Add to `src/data/writer.ts` after `editEntry` (`join`, `addEntry`, `deleteEntry`, `editEntry`, `resolveTargetFile` are already in scope):

```ts
export function moveEntry(
  dir: string,
  sourceFile: string,
  index: number,
  expectedAction: string,
  targetApp: string,
  entry: EntryInput,
): AddResult {
  // Defensive self-delete guard — do NOT trust the caller's app-change check.
  // If the target resolves to the source file, this is an in-place edit, not a
  // move; appending then deleting-by-index would corrupt the file.
  if (resolveTargetFile(dir, targetApp).file === join(dir, sourceFile)) {
    return editEntry(dir, sourceFile, index, entry, expectedAction);
  }

  const addRes = addEntry(dir, targetApp, entry);
  if (!addRes.ok) return addRes; // source untouched — safe abort

  const delRes = deleteEntry(dir, sourceFile, index, expectedAction);
  if (!delRes.ok) {
    // add succeeded, delete failed (drift / fs): keep both, warn. Never lose data.
    return {
      ok: true,
      file: addRes.file,
      created: addRes.created,
      lines: [`⚠ moved to ${targetApp}; original still in ${sourceFile} — remove it manually`],
    };
  }

  return {
    ok: true,
    file: addRes.file,
    created: addRes.created,
    lines: [`✓ moved '${entry.action}' → ${targetApp}`],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/writer.test.ts`
Expected: PASS (all existing writer tests + the 5 new move tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/writer.ts tests/writer.test.ts
git commit -m "feat(data): add moveEntry composing add-first then delete with self-delete guard"
```

---

### Task 4: Unlock the app field in edit (remove `lockedApp`, add `initialFocus`, seed `appIndex`)

**Files:**
- Modify: `src/tui/FormFields.tsx` (drop the `lockedApp` branch + prop)
- Modify: `src/tui/AddEntryForm.tsx` (drop `lockedApp`; add `initialFocus`; seed `appIndex`; floor `⌃P` at 0)
- Modify: `src/tui/App.tsx` (edit modal: `lockedApp` → `initialFocus={1}`)
- Test: `tests/form-views.test.tsx` (rewrite the locked-app render test); `tests/add-form.test.tsx` (rewrite the two locked-app edit tests)

**Interfaces:**
- Consumes: nothing new.
- Produces: `AddEntryForm` prop `initialFocus?: number` (default `0`); `lockedApp` prop removed from both `AddEntryForm` and `FormFields`. `appIndex` is seeded from `initial?.app`. App's `⌃P` floor is `0` (App field reachable).

- [ ] **Step 1: Migrate the three failing locked-app tests**

In `tests/form-views.test.tsx`, replace the `"renders the app field locked …"` test with:

```ts
it("renders the app field as a chooser (no lock) with the picker affordance", () => {
  const draft = { ...emptyDraft, app: "Fork", type: "shortcut" as const };
  const { lastFrame } = render(
    <FormFields draft={draft} apps={["Fork", "Zed"]} appIndex={0} focused={0} />,
  );
  const out = lastFrame() ?? "";
  expect(out).toContain("Fork");
  expect(out).toContain("(↑/↓)");
  expect(out).not.toContain("(locked)");
});
```

In `tests/add-form.test.tsx`, replace the `"pre-fills and locks the app in edit mode"` test with:

```ts
it("pre-fills the entry and starts focus on Type in edit mode (app unlocked)", async () => {
  const initial = entryToDraft("Fork", { action: "Push", keys: "⇧⌘P" });
  const { lastFrame } = render(
    <AddEntryForm
      apps={["Fork", "Zed"]}
      initialFocus={1}
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
  expect(out).toContain("Push");
  expect(out).toContain("⇧⌘P");
  expect(out).not.toContain("(locked)");
  expect(out).not.toContain("(↑/↓)"); // focus is on Type, not App
});
```

…and replace `"submits the locked app and edited action on confirm"` with:

```ts
it("submits the app and edited action on confirm in edit mode", async () => {
  const onSubmit = vi.fn(() => ok);
  const initial = entryToDraft("Fork", { action: "Push", keys: "⇧⌘P" });
  const { stdin } = render(
    <AddEntryForm
      apps={["Fork"]}
      initialFocus={1}
      initial={initial}
      onSubmit={onSubmit}
      onComplete={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  await tick();
  stdin.write("\x0e"); // ⌃N: Type(1) -> Action(2)
  await tick();
  stdin.write(" (force)");
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

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/form-views.test.tsx tests/add-form.test.tsx`
Expected: FAIL — `initialFocus` isn't a prop yet / app still renders `(locked)` / TS error on the removed `lockedApp`.

- [ ] **Step 3: Implement — drop `lockedApp` in `FormFields.tsx`**

In `src/tui/FormFields.tsx`, remove `lockedApp` from the props type and destructure, and replace the app-field block (the `{lockedApp ? (…) : draft.creatingApp ? (…) : (…)}` ternary) so only the chooser remains:

```tsx
{/* 0: app */}
<Box>
  <Text color={focused === 0 ? "cyan" : "gray"}>{"App".padEnd(8)}</Text>
  {draft.creatingApp ? (
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

- [ ] **Step 4: Implement — `AddEntryForm.tsx` props/focus/appIndex**

In `src/tui/AddEntryForm.tsx`:

1. Props: remove `lockedApp?: string;`, add `initialFocus?: number;`. Update the destructure (`lockedApp,` → `initialFocus,`).
2. Focus init: `const [focused, setFocused] = useState(initialFocus ?? 0);`
3. `appIndex` init — seed from the entry's app:
```tsx
const [appIndex, setAppIndex] = useState(() => {
  const i = apps.indexOf(initial?.app ?? apps[0] ?? "");
  return i >= 0 ? i : 0;
});
```
4. `⌃P` floor → 0: `if (key.ctrl && input === "p") return setFocused((f) => Math.max(f - 1, 0));`
5. The `<FormFields … />` call: remove the `lockedApp={lockedApp}` prop.

- [ ] **Step 5: Implement — `App.tsx` edit modal swap**

In `src/tui/App.tsx` (the `mode === "edit"` block), change `lockedApp={editTarget.app}` to `initialFocus={1}`. Leave `onSubmit`/`resolveTarget` as they are for now (Task 6 rewrites them).

- [ ] **Step 6: Run the migrated tests + the broader form suite**

Run: `pnpm exec vitest run tests/form-views.test.tsx tests/add-form.test.tsx tests/app.test.tsx`
Expected: PASS. (The existing app-level `"edits the selected entry on ⌃E …"` test still passes: focus starts at Type via `initialFocus={1}`, exactly as `lockedApp` used to force.)

- [ ] **Step 7: Commit**

```bash
git add src/tui/FormFields.tsx src/tui/AddEntryForm.tsx src/tui/App.tsx tests/form-views.test.tsx tests/add-form.test.tsx
git commit -m "feat(tui): unlock the app field in edit (initialFocus + seeded appIndex)"
```

---

### Task 5: Grab-and-move reorder input (`AddEntryForm` + `FormFields` passthrough)

**Files:**
- Modify: `src/tui/AddEntryForm.tsx` (add `stepCursor`/`grabbed` state, the field-3 recipe block, esc-grab intercept, pass props to `FormFields`)
- Modify: `src/tui/FormFields.tsx` (accept `stepCursor`/`grabbed`, forward to `StepsBuilder`)
- Test: `tests/add-form.test.tsx` (add reorder/delete/esc-grab tests)

**Interfaces:**
- Consumes: `moveStep`, `deleteStep` (Task 1); `StepsBuilder` cursor/grabbed props (Task 2); unlocked form (Task 4).
- Produces: in the recipe steps field — `↑/↓` move a cursor across steps + the append line; `Space`/`⏎` grab a step, `↑/↓` reorder it, `Space`/`⏎`/`esc` drop; `⌫` deletes the selected step; the append line keeps today's type/`⏎`-append behavior.

- [ ] **Step 1: Write the failing tests**

Append to `tests/add-form.test.tsx`:

```ts
it("reorders recipe steps with grab-and-move and writes the new order", async () => {
  const onSubmit = vi.fn(() => ok);
  const initial = entryToDraft("Finder", { action: "Do", steps: ["one", "two", "three"] });
  const { stdin } = render(
    <AddEntryForm apps={["Finder"]} initialFocus={3} initial={initial}
      onSubmit={onSubmit} onComplete={vi.fn()} onCancel={vi.fn()} />,
  );
  await tick();
  stdin.write("\x1b[A"); // ↑ append-line -> select "three"
  await tick();
  stdin.write(" "); // grab
  await tick();
  stdin.write("\x1b[A"); // move up -> ["one","three","two"]
  await tick();
  stdin.write("\x1b[A"); // move up -> ["three","one","two"]
  await tick();
  stdin.write(" "); // drop
  await tick();
  stdin.write("\x0e"); // ⌃N -> leave Steps to Tags
  await tick();
  stdin.write("\r"); // review
  await tick();
  stdin.write("\r"); // confirm
  await tick();
  expect(onSubmit).toHaveBeenCalledWith(
    "Finder",
    expect.objectContaining({ steps: ["three", "one", "two"] }),
  );
});

it("deletes the selected recipe step with ⌫", async () => {
  const onSubmit = vi.fn(() => ok);
  const initial = entryToDraft("Finder", { action: "Do", steps: ["one", "two", "three"] });
  const { stdin } = render(
    <AddEntryForm apps={["Finder"]} initialFocus={3} initial={initial}
      onSubmit={onSubmit} onComplete={vi.fn()} onCancel={vi.fn()} />,
  );
  await tick();
  stdin.write("\x1b[A"); // ↑ -> select "three"
  await tick();
  stdin.write("\x7f"); // ⌫ delete selected -> ["one","two"], cursor -> append line
  await tick();
  stdin.write("\x0e"); // ⌃N -> Tags
  await tick();
  stdin.write("\r"); // review
  await tick();
  stdin.write("\r"); // confirm
  await tick();
  expect(onSubmit).toHaveBeenCalledWith(
    "Finder",
    expect.objectContaining({ steps: ["one", "two"] }),
  );
});

it("esc while a step is grabbed drops the grab without cancelling the form", async () => {
  const onCancel = vi.fn();
  const initial = entryToDraft("Finder", { action: "Do", steps: ["one", "two"] });
  const { stdin, lastFrame } = render(
    <AddEntryForm apps={["Finder"]} initialFocus={3} initial={initial}
      onSubmit={vi.fn(() => ok)} onComplete={vi.fn()} onCancel={onCancel} />,
  );
  await tick();
  stdin.write("\x1b[A"); // select "two"
  await tick();
  stdin.write(" "); // grab
  await tick();
  stdin.write("\x1b"); // esc -> drop grab, NOT cancel
  await tick();
  expect(onCancel).not.toHaveBeenCalled();
  expect(lastFrame() ?? "").toContain("two");
  stdin.write("\x1b"); // esc again (not grabbed) -> cancels
  await tick();
  expect(onCancel).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/add-form.test.tsx -t "reorders recipe steps"`
Expected: FAIL — order unchanged (no cursor/grab logic yet); `onSubmit` called with original `["one","two","three"]`.

- [ ] **Step 3: Implement — `AddEntryForm.tsx` state + effect + input block**

In `src/tui/AddEntryForm.tsx`:

1. Imports: add `useEffect` to the React import; add `moveStep, deleteStep` to the `./useAddForm` import.
2. State (next to `focused`):
```tsx
const [stepCursor, setStepCursor] = useState(initial?.steps?.length ?? 0);
const [grabbed, setGrabbed] = useState(false);
```
3. Reset when not on the steps field (pins the cursor to the append line on entry):
```tsx
useEffect(() => {
  if (!(focused === 3 && draft.type === "recipe")) {
    setGrabbed(false);
    setStepCursor(draft.steps.length);
  }
}, [focused, draft.type, draft.steps.length]);
```
4. esc-grab intercept — insert as the FIRST line inside the form-screen handler, **before** `if (key.escape) return onCancel();`:
```tsx
if (grabbed && key.escape) return setGrabbed(false);
```
5. Replace the existing field-3 recipe block (`if (focused === 3 && draft.type === "recipe") { … }`) with:
```tsx
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
```
6. Pass the new state to `FormFields`: add `stepCursor={stepCursor}` and `grabbed={grabbed}` to the `<FormFields … />` call.

- [ ] **Step 4: Implement — `FormFields.tsx` passthrough**

In `src/tui/FormFields.tsx`, add `stepCursor?: number;` and `grabbed?: boolean;` to the props type and destructure, and forward them to `StepsBuilder`:
```tsx
<StepsBuilder
  steps={draft.steps}
  line={draft.stepLine}
  active={focused === 3}
  cursor={stepCursor}
  grabbed={grabbed}
/>
```

- [ ] **Step 5: Run the reorder tests + the full form suite**

Run: `pnpm exec vitest run tests/add-form.test.tsx tests/form-views.test.tsx tests/steps-builder.test.tsx`
Expected: PASS — including the existing `"counts a typed-but-not-appended recipe step …"` test (leaving the steps field still flushes the pending `stepLine` on review).

- [ ] **Step 6: Commit**

```bash
git add src/tui/AddEntryForm.tsx src/tui/FormFields.tsx tests/add-form.test.tsx
git commit -m "feat(tui): grab-and-move reorder + per-step delete in the recipe form"
```

---

### Task 6: App wiring — route edit vs move + app-aware `resolveTarget`

**Files:**
- Modify: `src/tui/App.tsx` (import `moveEntry`; add `sameApp`; edit modal `onSubmit` routing + `resolveTarget`)
- Test: `tests/app.test.tsx` (add a move-via-UI integration test)

**Interfaces:**
- Consumes: `moveEntry` (Task 3); unlocked, reachable app field (Task 4).
- Produces: edit submit routes `editEntry` (same app) vs `moveEntry` (changed app); the ReviewScreen shows the true destination because `resolveTarget` is app-aware.

- [ ] **Step 1: Write the failing test**

Append to `tests/app.test.tsx`:

```ts
it("moves the selected entry to another app via the edit form", async () => {
  const dir = tmpDataDir({
    "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
    "git.yaml": 'app: Git\nentries:\n  - action: Status\n    keys: "g s"\n',
  });
  const { entries } = loadEntries(dir);
  const { lastFrame, stdin } = render(<App entries={entries} dataDir={dir} />);
  await tick();
  // Browse order (app then action): Fork:Pull < Git:Status, so index 0 = Fork:Pull.
  stdin.write("\x05"); // ⌃E -> edit form (focus on Type)
  await tick();
  expect(lastFrame()).toContain("Edit entry");
  stdin.write("\x10"); // ⌃P: Type(1) -> App(0)  [validates the floor=0 change]
  await tick();
  stdin.write("\x1b[B"); // ↓: Fork -> Git
  await tick();
  stdin.write("\r"); // App ⏎ -> Type
  await tick();
  stdin.write("\r"); // Type ⏎ -> Action
  await tick();
  stdin.write("\r"); // Action ⏎ -> review
  await tick();
  expect(lastFrame()).toContain("git.yaml"); // review shows the move destination
  stdin.write("\r"); // confirm -> moveEntry + reload
  await tick();
  const { entries: after, errors } = loadEntries(dir);
  expect(errors).toEqual([]);
  expect(after.filter((e) => e.app === "Git").map((e) => e.action).sort()).toEqual(["Pull", "Status"]);
  expect(after.some((e) => e.app === "Fork")).toBe(false); // source emptied -> unlinked
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/app.test.tsx -t "moves the selected entry to another app"`
Expected: FAIL — review shows `fork.yaml` (resolveTarget thunk ignores the app) and/or the entry isn't moved (no routing).

- [ ] **Step 3: Implement — `App.tsx` routing + resolveTarget**

In `src/tui/App.tsx`:

1. Import: add `moveEntry`:
```ts
import { addEntry, deleteEntry, editEntry, listApps, moveEntry, resolveTargetFile } from "../data/writer";
```
2. Add a module-level helper (above the `App` component):
```ts
const sameApp = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
```
3. In the `mode === "edit"` block, replace the `resolveTarget` and `onSubmit` props with:
```tsx
resolveTarget={(app: string) =>
  sameApp(app, editTarget.app)
    ? { file: editTarget.file, created: false }
    : resolveTargetFile(dataDir, app)
}
onSubmit={(app: string, entry: EntryInput): AddResult =>
  sameApp(app, editTarget.app)
    ? editEntry(dataDir, editTarget.file, editTarget.index, entry, editTarget.action)
    : moveEntry(dataDir, editTarget.file, editTarget.index, editTarget.action, app, entry)
}
```
(Leave `initialFocus={1}`, `initial`, `title`, `onComplete`, `onCancel` as they are.)

- [ ] **Step 4: Run the integration test + full app suite**

Run: `pnpm exec vitest run tests/app.test.tsx`
Expected: PASS — the new move test plus the existing edit/delete/add tests (same-app edit still routes to `editEntry`).

- [ ] **Step 5: Commit**

```bash
git add src/tui/App.tsx tests/app.test.tsx
git commit -m "feat(tui): route edit vs move on app change; app-aware review target"
```

---

### Task 7: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. (Confirms `lockedApp` is fully removed and `initialFocus`/`moveEntry` types line up.)

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: no errors (no unused imports/props left from the `lockedApp` removal).

- [ ] **Step 3: Full test suite**

Run: `pnpm test`
Expected: all tests pass (every prior suite + the new reorder/move tests).

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: `tsdown` builds `dist/cli.js` with no errors.

- [ ] **Step 5: Manual smoke (optional but recommended)**

Run the TUI against a temp data dir, add/edit a recipe, reorder steps with ↑/↓ + Space, and edit an entry changing its app to confirm it relocates and `keybook check` exits 0. (Use the `run` skill if available.)

- [ ] **Step 6: Final commit (if any smoke fixups)**

```bash
git add -A
git commit -m "chore(tui): editing-polish verification pass"
```

---

## Self-Review

**1. Spec coverage:**
- §5 unlock app + seed appIndex + initialFocus → Task 4. ✓
- §5 app-aware `resolveTarget` (the critical fix) → Task 6 (test asserts `git.yaml` in review). ✓
- §6 `moveEntry` add-first, partial-failure, defensive guard → Task 3. ✓
- §8 reorder cursor/grab + per-step delete + esc-grab + every-branch-returns → Tasks 2 & 5. ✓
- §8.4 block-cursor only on append line → Task 2 (`active && onAppendLine`). ✓
- §11 migrate 3 lockedApp tests → Task 4. ✓
- §11 move/reorder keep `check` green → asserted via `loadEntries(dir).errors == []` in Tasks 3 & 6. ✓
- Reorder works in `add` too → covered by the existing add-flow recipe test staying green (Task 5 Step 5). ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code; every command has expected output. ✓

**3. Type consistency:** `moveEntry(dir, sourceFile, index, expectedAction, targetApp, entry)` identical in §4.1, Task 3 impl, Task 6 call. `initialFocus?: number`, `stepCursor`/`grabbed`, `moveStep`/`deleteStep` names consistent across Tasks 1/2/4/5/6. `sameApp` defined once (Task 6). ✓
