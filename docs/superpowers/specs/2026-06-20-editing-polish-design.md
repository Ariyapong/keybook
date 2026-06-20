# keybook editing polish — recipe-step reorder & move-entry — design spec

| | |
|---|---|
| **Status** | Draft, pending review |
| **Date** | 2026-06-20 |
| **Target** | v0.7 — reorder recipe steps; move an entry to another app |
| **Reference** | [`edit`/`delete` design spec](2026-06-06-keybook-edit-delete-design.md) (§15 deferred both items) · [`add` design spec](2026-06-02-keybook-add-design.md) (§5 write path, §5.1 preservation contract) |
| **Shipped baseline** | `@arthony/keybook@0.6.x` on npm; `add` / `edit` / `delete` write paths live; favorites + app filter live |

> Two editing-quality features deferred from the `edit`/`delete` work (§15) ship together
> as v0.7. Both ride entirely on existing seams — **no new runtime dependency, no schema
> change, no new CLI surface, no new top-level module.** Move composes the *already
> empirically-verified* `addEntry` + `deleteEntry` (edit-spec §12); reorder is a pure
> in-form interaction over `Draft.steps` that the existing write path persists unchanged.

---

## 1. Executive summary

`add`/`edit`/`delete` closed the CRUD loop, but two rough edges remain in the editing
experience:

1. **Recipe steps are append-only.** The `StepsBuilder` can only append a step (`⏎`) or
   remove the *last* one (`⌫` on an empty line). Fixing the order of a five-step recipe —
   or removing step 2 — means deleting back to it and retyping everything after. There is
   no per-step cursor.
2. **An entry is married to its app.** `edit` deliberately **locks** the app field
   (edit-spec §2/§3), so a misfiled entry (e.g. a Git shortcut authored under "Fork") can
   only be relocated by delete-here + add-there by hand.

This spec adds:

- **Step reorder + per-step delete** — a *grab-and-move* cursor in the steps builder
  (`↑/↓` select, `Space`/`⏎` grab-and-drop, `⌫` delete). Works in both `add` and `edit`.
- **Move entry to another app** — by **unlocking the app field in the edit form**.
  Change the app and save → the entry is *relocated* (added to the target, removed from the
  source). Leave the app unchanged → it edits in place exactly as today. You can fix a value
  **and** move in one action.

Both act on the entry you already found and selected. No new top-level keybinding: reorder
is discovered inside the recipe form; move is discovered inside the edit form.

---

## 2. Goals & non-goals

### Goals
- **Reorder and delete any recipe step**, not just the last, without retyping the rest.
- **Move an entry to another app** (existing or brand-new) from inside the edit form, with
  the destination visible in the `ReviewScreen` before confirming.
- **Reuse, don't rebuild:** move composes the existing `addEntry` + `deleteEntry`
  (their drift guards, empty-file unlink, and post-write safety nets carry over verbatim);
  reorder reuses the existing form, `Draft.steps`, and the `draftToEntryInput` write path.
- **Every mutation stays schema-valid or is rejected loudly** — the `keybook check`
  invariant (a write never leaves a file that fails `check`) extends to move.
- **No data loss on move**, even on partial failure: the worst case is a *recoverable
  duplicate*, never a vanished entry.
- Zero new runtime dependencies; no schema change; no new CLI command.

### Non-goals
- **Mid-string text editing of a step** (fixing a typo *inside* step 2). Delete + retype
  for now; this is the same append+backspace limitation `add`/`edit` already have for every
  field (no cursor model — that is the separate Phase-B readline backlog).
- **Modifier-arrow reorder** (`⌥↑`/`⇧↑`). Deliberately avoided — grab-mode uses only keys
  Ink reports reliably across terminals (§13).
- **Bulk move / bulk reorder**, **undo / trash / soft-delete**, **CLI or non-interactive
  move**, **near-duplicate detection** when a move lands next to a similar entry.
- Any change to search ranking, preview rendering, the schema, or `keybook check`.

---

## 3. Decisions

Settled during brainstorming (2026-06-20):

| Decision | Choice |
|---|---|
| Scope | **Both features in one release (v0.7).** They share the "editing polish" theme and one spec/plan. |
| Move trigger | **Unlock the app field in the edit form.** App changed on save → move; unchanged → in-place edit. No separate command, no new keybinding. |
| Move to a new app | **Supported, free** — via the existing "Create new app…" choice in the app chooser; `addEntry` creates the file. |
| Accidental-move guard | In edit, **focus starts on Type (field 1), not App.** The app field is reachable (⌃P up) but never the default landing spot, so "just fix a value" never touches it. The `ReviewScreen` target path is the final confirmation. |
| Move safety ordering | **Add-to-target first, then delete-from-source.** Never delete before the copy is safely written (§6). |
| Move partial failure | Add ok + delete fails → **keep both, warn** ("exists in both — remove manually"). Recoverable duplicate over data loss. |
| Reorder interaction | **Grab-and-move.** `↑/↓` select a step (or the append line); `Space`/`⏎` grab, `↑/↓` move, `Space`/`⏎`/`esc` drop; `⌫`/`⌦` delete the selected step. |
| Reorder scope | Includes **per-step delete** (the cursor makes it nearly free; supersedes today's last-only delete). Excludes mid-string step text edit (§2). |
| Where reorder lives | The recipe steps field of the **shared form**, so it works in `add` *and* `edit` at no extra cost. |

**Supersedes the edit-spec app-lock decision.** Edit-spec §2/§3 locked the app because move
was explicitly out of scope *then*. This spec reverses that on purpose: the app field is now
selectable in edit, and changing it is the move trigger. The `lockedApp` prop introduced for
edit is **removed** (it was used only to render the locked app; nothing else depends on it).

---

## 4. Architecture & module boundaries

The change rides existing seams. `entrySchema` stays the single source of truth; `writer.ts`
remains the only code that mutates YAML; the TUI calls the writer directly, exactly as it
already calls `addEntry`/`editEntry`/`deleteEntry`. **No new modules, no new CLI surface.**

| File | Change | Responsibility |
|---|---|---|
| `src/data/writer.ts` | edit | Add `moveEntry(dir, sourceFile, index, expectedAction, targetApp, entry)` that composes `addEntry` (target) then `deleteEntry` (source), with the partial-failure rule (§6). `addEntry`/`deleteEntry`/`editEntry` unchanged. |
| `src/tui/useAddForm.ts` | edit | Add pure helpers `moveStep(steps, from, to): string[]` and `deleteStep(steps, i): string[]` for the reorder logic + unit tests. `Draft`/`entryToDraft`/`draftToEntryInput` unchanged. |
| `src/tui/AddEntryForm.tsx` | edit | Remove `lockedApp`; add `initialFocus?: number`; seed `appIndex` from `initial.app`; add `stepCursor`/`grabbed` state and the field-3 recipe grab logic; intercept `esc`/field-nav while grabbed; pass `onSubmit` through unchanged (routing lives in `App`). |
| `src/tui/FormFields.tsx` | edit | Remove the `lockedApp` read-only branch; the app field is always the chooser. Pass `stepCursor`/`grabbed` through to `StepsBuilder`. |
| `src/tui/StepsBuilder.tsx` | edit | Render a per-step cursor marker (`>`), a grabbed marker (`⇅`), and the dynamic reorder hint. New props: `cursor`, `grabbed`. |
| `src/tui/App.tsx` | edit | (1) Edit `onSubmit` **routes**: same app → `editEntry`; different app → `moveEntry`. `editTarget` carries the original app + action used as the move's source drift guard. (2) **The edit modal's `resolveTarget` prop becomes app-aware** — today it is a no-arg thunk hardcoded to the source file (`App.tsx:214`), so it must change or the ReviewScreen never shows a move's destination (§5). |

### 4.1 Types & signatures

```ts
// src/data/writer.ts
export function moveEntry(
  dir: string,
  sourceFile: string,    // basename, e.g. "fork.yaml"
  index: number,         // original YAML index of the source entry
  expectedAction: string,// ORIGINAL action — the source delete's drift guard
  targetApp: string,     // resolved destination app (may be brand-new)
  entry: EntryInput,     // the (possibly edited) entry to write into the target
): AddResult;

// src/tui/useAddForm.ts (pure)
export function moveStep(steps: string[], from: number, to: number): string[];
export function deleteStep(steps: string[], i: number): string[];
```

`AddResult` is reused (`created` reflects whether the *target* file was newly created;
`file` is the target path; `lines` are the flash messages). No new result type.

---

## 5. Move-entry — the form (unlock the app field)

Edit reuses the v0.3/v0.4 form; the additions are backward-compatible and concentrated on
the app field.

- **App field is the normal chooser in edit.** `FormFields` no longer special-cases a locked
  app; it renders the `[...apps, "Create new app…"]` chooser with the `↑/↓` affordance, the
  same as `add`.
- **Seed the chooser to the entry's current app (display only).** Today `appIndex` always
  starts at `0`, while `draft.app` is already correct (set by `entryToDraft`), so the chooser
  *displays* `apps[0]` even though the entry's real app would be submitted — a visible
  mismatch. Seed `appIndex` to the entry's app so the highlight matches what will be saved:
  ```ts
  const [appIndex, setAppIndex] = useState(() => {
    const i = apps.indexOf(initial?.app ?? apps[0] ?? "");
    return i >= 0 ? i : 0;
  });
  ```
  For `add`, `initial` is undefined, so `initial?.app ?? apps[0]` resolves to `apps[0]` and
  `indexOf` returns `0` — unchanged behavior. Note: this fixes only the *displayed* highlight;
  `resolvedApp(review)`/`draft.app` are already correct on first render via `entryToDraft`
  (`creatingApp` starts `false`, so `resolvedApp` returns `draft.app`).
- **Focus starts on Type, not App, in edit.** New `initialFocus?: number` prop (default `0`).
  Edit passes `initialFocus={1}`. The `⌃P` floor returns to `0` (App is reachable upward).
  This is the accidental-move guard: the default "fix a value" path never lands on App.
- **Submit signature unchanged.** The form still calls `onSubmit(resolvedApp, entry)` and
  does not know edit-vs-move. `App` supplies an `onSubmit` that routes (§7).
- **`ReviewScreen` must be made to show the destination — this requires an App change.**
  `AddEntryForm` already computes `targetPath` from `resolveTarget(resolvedApp(review))`
  (`AddEntryForm.tsx:73`), and `resolvedApp` already reflects a changed app. **But the edit
  modal currently passes a no-arg thunk** that ignores the app and always returns the source
  file (`App.tsx:214`: `resolveTarget={() => ({ file: editTarget.file, created: false })}` —
  deliberately, to avoid re-resolving by app name when two files share an app). With that
  thunk, a changed app still shows the *source* file and the accidental-move guard silently
  fails. **Fix — make the edit modal's `resolveTarget` app-aware while preserving the
  same-app behavior:**
  ```ts
  resolveTarget={(app) =>
    sameApp(app, editTarget.app)
      ? { file: editTarget.file, created: false }   // unchanged app → exact source file
      : resolveTargetFile(dataDir, app)}            // changed app → real destination (+ created)
  ```
  Same-app returns the exact source file (honoring the original two-files-share-an-app
  concern); a changed app delegates to `resolveTargetFile`, so an existing target reads
  `→ git.yaml` and a brand-new app reads `→ slack.yaml (new)` (the `(new)` suffix is driven
  by `resolveTargetFile`'s `created` flag, reachable only once the thunk stops short-circuiting).
  `AddEntryForm.tsx:74` basenames the result, so a basename (`editTarget.file`) vs a full path
  (`resolveTargetFile`) are equivalent for display.
- **Title** still passes `"Edit entry — <originalApp>"` for context.

Moving to a brand-new app is the existing "Create new app…" flow: type the name, advance,
submit; `App` routes to `moveEntry(targetApp = newName)` and `addEntry` creates the file via
`freshPath`/`slugify`.

---

## 6. Move-entry — the write path (`writer.ts`)

`moveEntry` composes two already-tested, already-verified functions. **No new YAML AST
behavior is introduced** — the `Document` mutations, the empty-file unlink, the drift guards,
and the post-write safety nets are exactly those verified in edit-spec §12.

```
moveEntry(dir, sourceFile, index, expectedAction, targetApp, entry):
  0. // DEFENSIVE self-delete guard — do NOT trust the caller's app-change check.
     // If the target resolves to the source file (same app, however reached), this
     // is an in-place edit, not a move: appending then deleting-by-index would
     // corrupt the file. Delegate instead of risking it.
     if (resolveTargetFile(dir, targetApp).file === join(dir, sourceFile))
        return editEntry(dir, sourceFile, index, entry, expectedAction)

  1. addRes = addEntry(dir, targetApp, entry)
        // validates (entrySchema), rejects a stray `app`, appends to the target
        // (or creates it), and runs its own post-write safety net.
     if (!addRes.ok) return addRes               // SOURCE UNTOUCHED — safe abort

  2. delRes = deleteEntry(dir, sourceFile, index, expectedAction)
        // drift-guards on the ORIGINAL action, removes the source node, and
        // unlinks the source file if it was the last entry.

  3. if (delRes.ok)
        // deleteEntry signals an emptied source only as the literal substring
        // "(removed empty <file>)" inside delRes.lines[0] (writer.ts:209-211) —
        // there is NO structured boolean. Either surface delRes.lines[0] as-is on
        // the emptied path, or just use the simple message below; do not read a
        // non-existent flag.
        return { ok:true, file: addRes.file, created: addRes.created,
                 lines: [`✓ moved '${entry.action}' → ${targetApp}`] }
     else
        // add succeeded, delete failed (drift / fs error): keep both, warn.
        return { ok:true, file: addRes.file, created: addRes.created,
                 lines: [`⚠ moved to ${targetApp}; original still in ${sourceFile} ` +
                         `— remove it manually`] }
```

### 6.1 Why add-first
Deleting before the copy is durably written would risk a window where the entry exists
nowhere if the add then fails. **Add-first** guarantees the entry is never lost: an add
failure aborts with the source intact; a delete failure leaves a duplicate, which is
visible, valid, and trivially removable with `⌃X`. `ok:true` in the partial case is
deliberate — the move's primary effect (the entry now lives in the target) *did* happen, so
the TUI should `reload()` and show it; the flash carries the warning.

### 6.2 Drift & app-change guarantees
- The **source delete uses the original action** (`editTarget.action`), so the drift guard
  matches the on-disk original even when the user edited fields during the move.
- **Source/target distinctness is not intrinsic to `moveEntry` — it follows from
  `targetApp ≠ sourceApp`** (case-insensitive, trimmed). Because `findFileForApp` keys on the
  lowercased/trimmed `app:` value (`writer.ts:51-57`), a target app that differs from the
  source app cannot resolve to *any* file whose app equals the source — including the source
  file. Note the data model permits **multiple files sharing one app value** (`findFileForApp`
  returns the first match; `freshPath` even mints `git-2.yaml`), so the guarantee rests on the
  app-inequality route, **not** on one-file-per-app. App's §7 router enforces inequality, and
  step 0's defensive guard backstops it if a future caller ever forgets. A case-only "change"
  (`VS Code` → `vscode`) resolves to the same file and is routed to `editEntry`, not a move.
- Inherited invariants: `addEntry` already rejects a stray `app` field and validates against
  `entrySchema`; the move entry comes from `draftToEntryInput`, which never sets `app`, so the
  guard is satisfied, not tripped. `deleteEntry` already unlinks a file emptied to `[]` (an
  empty `entries:` fails `fileShape`, edit-spec §3).

---

## 7. Move-entry — app wiring (`App.tsx`)

The edit modal's `onSubmit` gains a route:

```ts
const sameApp = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

// edit modal:
onSubmit={(app, entry) =>
  sameApp(app, editTarget.app)
    ? editEntry(dataDir, editTarget.file, editTarget.index, entry, editTarget.action)
    : moveEntry(dataDir, editTarget.file, editTarget.index, editTarget.action, app, entry)
}
```

`onComplete` is unchanged in spirit: `reload()`, flash `result.lines[0]`, `setMode("search")`,
clear `editTarget`. After a move the entry leaves its old position; the existing `selected`
clamping keeps the cursor in range (no special reset needed). `⌃E` entry point, the search
input handler order, and the delete-confirm flow are all untouched.

---

## 8. Step reorder — cursor + grab (`AddEntryForm`, `StepsBuilder`, `FormFields`)

Reorder is a pure in-form interaction over `Draft.steps: string[]`. The reordered/edited
array flows through the unchanged `draftToEntryInput` → `editEntry`/`addEntry`/`moveEntry`
write path; **no writer change is needed for reorder.**

### 8.1 State
Two transient fields in `AddEntryForm` (alongside `focused`), not in `Draft`:
```ts
const [stepCursor, setStepCursor] = useState(0); // 0..steps.length; steps.length = append line
const [grabbed, setGrabbed] = useState(false);
```
The append line is the position `stepCursor === steps.length`. **When the steps field gains
focus**, `stepCursor` is set to the append line (`steps.length`) — the ready-to-add default
that matches today's behavior (for an edited recipe with N existing steps, the cursor starts
below them). On leaving the steps field (any field change) or unmounting, reset
`grabbed=false` and `stepCursor` back to the append line — a clean slate on return.

### 8.2 Input handling (field 3, `type === "recipe"`)
Processed inside the existing field-3 recipe block; the existing `⌃N`/`⌃P` field-nav and the
top-level `esc` are adjusted to respect a live grab (§8.3).

```
const onAppendLine = stepCursor === steps.length

if (grabbed) {                                   // moving the picked-up step
  if (upArrow   && stepCursor > 0)             → steps = moveStep(steps, stepCursor, stepCursor-1); stepCursor--
  if (downArrow && stepCursor < steps.length-1)→ steps = moveStep(steps, stepCursor, stepCursor+1); stepCursor++
  if (return || input===" " || escape)         → grabbed = false
  return                                          // swallow everything else while grabbed
}

if (onAppendLine) {                              // today's behavior, plus cursor-up
  if (return)            → if stepLine.trim(): steps.push(stepLine.trim()); stepLine = ""; stepCursor = steps.length;  return  // stay on the NEW append line
  if (backspace/delete)  → if stepLine: stepLine = stepLine.slice(0,-1);  return
                           else if steps.length: stepCursor = steps.length-1;  return        // select last (no delete)
                           else return
  if (upArrow)           → if steps.length: stepCursor = steps.length-1;  return
  if (printable)         → stepLine += input;  return    // includes a literal Space here
  return                                                 // swallow anything else
} else {                                          // cursor is on an existing step
  if (upArrow)           → stepCursor = max(0, stepCursor-1);  return
  if (downArrow)         → stepCursor++;  return  // steps.length lands on the append line
  if (return || input===" ") → grabbed = true;  return     // pick it up
  if (backspace/delete)  → steps = deleteStep(steps, stepCursor); clamp stepCursor;  return
  return    // printable keys ignored on a step (mid-string edit out of scope, §2)
}
```

> **Load-bearing invariant: every branch of the field-3 recipe block MUST `return`.** Today's
> recipe block already does (`AddEntryForm.tsx:147`). If any key falls through, it reaches the
> generic text fallthrough (`AddEntryForm.tsx:150-165`), which maps recipe's field-3 to the
> **`keys`** field — a leaked printable would append to `draft.keys` and a leaked `⌫` would
> slice it, silently injecting a phantom `keys:` into a recipe entry via `draftToEntryInput`.
> The trailing `return` in each branch above is not optional.

`moveStep`/`deleteStep` are the pure helpers from §4.1. The append-line `⏎`/typing path is
behavior-identical to today. **Two legacy behaviors change by cursor position** (both covered
by tests): empty-`⌫` on the append line now *selects the last step* instead of deleting it
(deletion moved onto the cursor); and **`Space` now grabs/drops when the cursor is on a step**,
while still typing a literal space on the append line (`AddEntryForm.tsx:146`).

### 8.3 Grab vs. form-level keys
- **`esc` while grabbed drops the grab** instead of cancelling the form. Add, *before* the
  existing `if (key.escape) return onCancel()` on the form screen:
  ```ts
  if (grabbed && key.escape) { setGrabbed(false); return; }
  ```
- **`⌃N`/`⌃P` while grabbed** drop the grab and then move fields as usual (leaving the field
  resets grab state anyway, §8.1).

### 8.4 Rendering (`StepsBuilder`)
New props `cursor: number`, `grabbed: boolean` (only meaningful when `active`). Per row:
- prefix marker: `active && cursor === i` → `grabbed ? "⇅ " : "> "`, else two spaces.
- the append line: **render the inverse block-cursor only when `cursor === steps.length`**
  (the cursor is actually on the append line). When the cursor is parked on an existing step,
  the append row still shows its `stepLine` text but **without** the block-cursor, so there is
  exactly one active indicator on screen (the `>`/`⇅` marker on the parked step) — today's
  `StepsBuilder` always draws the block-cursor whenever `active`, which would otherwise show
  two cursors at once.
- hint line (only when `active`): on the append line → `⏎ adds · ↑ select a step`; on a step →
  `↑↓ select · Space grab · ⌫ delete`; while grabbed → `↑↓ move · Space/⏎ drop`.

When the steps field is **not** focused, `StepsBuilder` renders the plain numbered list (no
markers), exactly as today.

---

## 9. Footer & hints

- **Form bottom hint** (`AddEntryForm`): the existing `⌃N next · ⌃P prev · ⏎ <enterHint> ·
  esc cancel` line is unchanged; the reorder hints live inside the steps field (§8.4) so they
  appear only when relevant.
- **Search-TUI footer** (`Footer.tsx`): **unchanged.** `⌃E edit` already advertises the entry
  point for both edit and move; reorder and move are discovered inside the form. No new
  top-level keybinding is added.

---

## 10. Error handling

| Situation | Behavior |
|---|---|
| Move: target add fails (validation, fs, safety-net) | Abort; **source untouched**; flash the add's error (`addRes.lines`). |
| Move: add ok, source delete fails (drift / fs) | Keep both; flash `⚠ moved to <app>; original still in <source> — remove it manually`. `ok:true` → reload shows the moved copy. |
| Move: source was the last entry in its file | Source file is unlinked (inherited `deleteEntry` behavior). The emptied signal is only a substring in `delRes.lines[0]` (no struct field); `moveEntry` may surface it or use the plain `✓ moved` flash (§6 step 3). |
| Move to a case-only "different" app (`VS Code`→`vscode`) | Routed to `editEntry` (same file), not a move. |
| Reorder/delete on an empty steps list | Only the append line exists; grab is impossible; today's "⏎ adds a step" hint shows. |
| `esc` while a step is grabbed | Drops the grab; the form is **not** cancelled. |
| `esc` while not grabbed | Cancels the form (unchanged). |
| Leaving the steps field mid-grab (`⌃N`/`⌃P`) | Grab dropped; `stepLine` flushed by `flushStep` on review as today. |
| Submit with the app unchanged | `editEntry` in place — byte-for-byte the current edit behavior. |

---

## 11. Testing (TDD, existing conventions)

- **`tests/useAddForm.test.ts`** — `moveStep` swaps adjacent and far indices and is a no-op
  at the ends; `deleteStep` removes the right element and clamps; reordered steps survive a
  `draftToEntryInput(entryToDraft(...))` round-trip.
- **`tests/writer.test.ts` (move)** — moves to an **existing** app (entry appended to target,
  removed from source; siblings + comments preserved on both sides); moves to a **new** app
  (target file created via slug); **source emptied → unlinked**; **add-fails → source
  untouched** (induced invalid entry); **delete-drift → both files retain the entry + warning
  returned**; the post-move corpus passes `loadEntries` with no new error.
- **`tests/app.test.tsx`** (`ink-testing-library`) — in the recipe form, grab (`Space`) +
  `↑/↓` reorders steps and the new order appears in the review/written entry; `⌫` on a
  selected step deletes it; reorder works in the **add** flow too; in **edit**, changing the
  app and saving relocates the entry (it appears under the new app in search, gone from the
  old); changing **nothing but a value** edits in place; focus starts on Type in edit.
- **`tests/integration` / PTY smoke** — a move end-to-end against a `tmpDataDir` keeps
  `keybook check` at exit `0`; moving the last entry out of a file removes the file and
  `check` stays `0`; a reorder round-trips and `check` stays `0`.
- **Update the existing `lockedApp` tests** (they assert behavior this spec removes, so they
  *will* fail unless changed — they are not optional):
  - `tests/form-views.test.tsx` (~:30-39) asserts the app field renders `(locked)` and *not*
    `Create new app`/`(↑/↓)`. **Rewrite** to assert the seeded chooser shows the entry's app
    *with* the `(↑/↓)` affordance.
  - `tests/add-form.test.tsx` (~:138-157, "pre-fills and locks the app in edit mode") asserts
    `toContain("(locked)")`. **Rewrite** to assert the chooser is seeded to the entry's app
    and focus starts on Type (`initialFocus`).
  - `tests/add-form.test.tsx` (~:159-186, "submits the locked app…"). **Update** to drop the
    `lockedApp` prop and assert the same-app submit still routes to `editEntry` (in place).
- All other existing tests stay green; the three `lockedApp` assertions above are migrated to
  the new chooser behavior (not deleted blindly — their *intent* (edit pre-fills correctly,
  submit writes the right file) is preserved against the new UI).

---

## 12. Tech-stack additions

| Area | Change |
|---|---|
| Runtime / deps | **None.** Move composes existing writer functions; reorder is in-form React state. |
| New modules | **None** — all changes edit existing files. |
| New CLI surface | **None** — in-TUI only. |
| Schema | **None** — `entrySchema` unchanged; `steps` is still `string[]`. |

---

## 13. Empirical verification

No new external-API behavior is introduced, so the verification burden is small and largely
*inherited*:

- **Move's YAML mutations are already verified.** `moveEntry` performs no new AST work — it
  calls `addEntry` (`addIn` + `createNode`, add-spec §5) and `deleteEntry` (`deleteIn`,
  empty-seq `[]` detection, sibling-comment preservation — edit-spec §12-C1/C4). Those checks
  stand; this spec adds only the composition order and the partial-failure branch, which are
  plain control flow.
- **The Ink inputs reorder relies on are already exercised in this very form.** The Type
  toggle reads `input === " "` (Space) and the App field reads `key.upArrow`/`key.downArrow`
  (`AddEntryForm.tsx`). Grab-mode uses exactly these — **no modifier+arrow detection**, which
  is precisely why grab-mode was chosen over `⌥↑/⌥↓` (Ink reports modifier+arrow combos
  inconsistently across terminals). So there is **no new terminal-detection risk**.
- **One thing to confirm during build** (cheap, not API-level): that intercepting `esc` for
  grab-drop *before* the form's `onCancel` does not strand the user — covered by an
  `ink-testing-library` assertion (esc-while-grabbed leaves the form open; esc-otherwise
  cancels).

---

## 14. Acceptance criteria

### Reorder
- [ ] In a recipe form, `↑/↓` move a step cursor across the steps and the append line.
- [ ] `Space`/`⏎` grabs the selected step; `↑/↓` then reorders it; `Space`/`⏎`/`esc` drops it.
- [ ] `⌫`/`⌦` deletes the selected step (not only the last); the append line keeps its
      current type/`⏎`-append behavior.
- [ ] A reordered/edited `steps` array is written correctly via the existing path; `check`
      passes. Reorder works in both `add` and `edit`.

### Move
- [ ] In edit, the app field is selectable, seeded to the entry's app, with focus starting on
      Type; the `ReviewScreen` shows the destination file **after** the edit modal's
      `resolveTarget` is made app-aware (§5) — verify a changed app reads `→ <target>` /
      `→ <new> (new)`, not the source file.
- [ ] Saving with the app **changed** relocates the entry (added to target — existing or new
      — and removed from source; source file unlinked if it emptied); saving with the app
      **unchanged** edits in place.
- [ ] On a partial failure (target written, source delete fails) the entry is **kept in
      both** and the user is warned — never lost.
- [ ] After any move, `loadEntries` reports no new error and `keybook check` passes.

### Reuse & quality
- [ ] `moveEntry` reuses `addEntry` + `deleteEntry` (their drift guards, empty-file unlink,
      and safety nets); reorder reuses the form, `Draft.steps`, and `draftToEntryInput`.
- [ ] No new runtime dependency, no new CLI command, no new module, no schema change.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green; all prior tests pass **after** the
      three `lockedApp` assertions are migrated to the new chooser behavior (§11).

---

## 15. Risks & open questions

| Item | Risk | Mitigation |
|---|---|---|
| Move loses the entry on a mid-operation failure | **High if wrong** | Add-first ordering (§6.1); add-failure aborts with source intact; delete-failure keeps a recoverable duplicate; `ok:true` only after the target write durably succeeds. |
| Accidental relocation while editing | Medium | Focus starts on Type, never App; the `ReviewScreen` target path shows the destination before the confirm. |
| Grab-mode `esc`/field-nav stranding the user | Low | `esc` while grabbed drops the grab (intercepted before `onCancel`); leaving the field resets grab state; covered by an `ink-testing-library` test. |
| Reorder relies on an unsupported key | Low | Grab-mode uses only `↑/↓` and `Space`/`⏎`, already exercised in this form (§13); no modifier-arrow detection. |
| Comment attached to a reordered step | Low (accepted) | Reorder rewrites the whole `steps` scalar list via `createNode`; per-step inline comments are not preserved (same cosmetic-churn contract as add/edit, §5.1 of the add spec). Steps rarely carry comments. |
| Empty-`⌫` semantics change on the append line | Low | Now selects the last step instead of deleting it; deletion moved onto the cursor — documented (§8.2), covered by a test. |

---

## 16. Deferred (v0.8+)

| Item | Notes |
|---|---|
| **Mid-string step text edit** | Editing inside a step needs the cursor model from the Phase-B readline backlog; out of scope here. |
| **Bulk move / reorder**, **undo / trash** | A wrong move is reversible by another move; a wrong delete by re-add. Soft-delete only if demand appears. |
| **CLI / non-interactive move** | Targeting one entry by flag is fiddly; the TUI is where you find and act on entries. |
| **Near-duplicate detection on move** | No dedup today; a move can land beside a similar entry — flag later if it bites. |

---

## 17. References

- `edit`/`delete` design spec (`2026-06-06-keybook-edit-delete-design.md`) — §6 write path,
  §12 empirical YAML verification, §15 deferral of reorder + move.
- `add` design spec (`2026-06-02-keybook-add-design.md`) — §5 write path, §5.1 preservation
  contract.
- `yaml` Document API: https://eemeli.org/yaml/#modifying-nodes
- Ink `useInput`: https://github.com/vadimdemedes/ink#useinputinputhandler-options

---

*End of spec. Move introduces no new YAML AST behavior (composes verified functions);
reorder uses only already-exercised Ink inputs. Implementation plan next via the
writing-plans skill.*
