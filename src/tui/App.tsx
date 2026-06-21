import { Box, useApp, useInput, useStdout } from "ink";
import { useCallback, useMemo, useState } from "react";
import { copyToClipboard } from "../clipboard";
import { favKey, loadFavorites, toggleFavorite } from "../data/favorites";
import { loadEntries } from "../data/loader";
import type { AddResult, Entry, EntryInput, LoadedEntry } from "../data/types";
import {
  addEntry,
  deleteEntry,
  editEntry,
  listApps,
  moveEntry,
  resolveTargetFile,
} from "../data/writer";
import { search } from "../search";
import { AddEntryForm } from "./AddEntryForm";
import { type Filter, FilterPicker } from "./FilterPicker";
import { Footer } from "./Footer";
import { PreviewPane } from "./PreviewPane";
import { ResultList } from "./ResultList";
import { SearchInput } from "./SearchInput";
import { deleteWordBack } from "./input";
import { columnWidths, visibleListHeight } from "./layout";
import { entryToDraft } from "./useAddForm";

const sameApp = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export interface AppProps {
  entries: LoadedEntry[];
  errorCount?: number;
  dataDir?: string;
  onCopy?: (text: string) => boolean;
}

export function App({
  entries: initial,
  errorCount = 0,
  dataDir,
  onCopy = copyToClipboard,
}: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [entries, setEntries] = useState(initial);
  const [mode, setMode] = useState<"search" | "add" | "edit" | "filter">("search");
  const [filter, setFilter] = useState<Filter>({ type: "all" });
  const [favorites, setFavorites] = useState<Set<string>>(() =>
    dataDir ? loadFavorites(dataDir) : new Set<string>(),
  );
  const [editTarget, setEditTarget] = useState<LoadedEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LoadedEntry | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [flash, setFlash] = useState("");

  const reload = useCallback(() => {
    if (dataDir) setEntries(loadEntries(dataDir).entries);
  }, [dataDir]);

  const scoped = useMemo(() => {
    if (filter.type === "app") return entries.filter((e) => e.app === filter.app);
    if (filter.type === "favorites")
      return entries.filter((e) => favorites.has(favKey(e.app, e.action)));
    return entries;
  }, [entries, filter, favorites]);
  const results = useMemo(() => search(scoped, query), [scoped, query]);
  const sel = results.length ? Math.min(selected, results.length - 1) : 0;
  const current = results[sel];
  const listHeight = visibleListHeight(stdout?.rows);
  const { left, right } = columnWidths(stdout?.columns);

  useInput(
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
        if (filter.type !== "all") {
          setFilter({ type: "all" });
          setSelected(0);
          return;
        }
        exit();
        return;
      }
      if (dataDir && key.ctrl && input === "o") {
        setMode("add");
        return;
      }
      if (dataDir && current && key.ctrl && input === "e") {
        setEditTarget(current);
        setMode("edit");
        return;
      }
      if (dataDir && current && key.ctrl && input === "x") {
        setPendingDelete(current);
        return;
      }
      if (key.ctrl && input === "f") {
        setMode("filter");
        return;
      }
      if (dataDir && current && key.ctrl && input === "s") {
        const next = toggleFavorite(dataDir, current.app, current.action);
        setFavorites(next);
        setFlash(next.has(favKey(current.app, current.action)) ? "★ starred" : "☆ unstarred");
        return;
      }
      if (key.downArrow || (key.ctrl && input === "n")) {
        setSelected((s) => Math.min(s + 1, results.length - 1));
        return;
      }
      if (key.upArrow || (key.ctrl && input === "p")) {
        setSelected((s) => Math.max(s - 1, 0));
        return;
      }
      if (key.return) {
        if (current) {
          const text = current.keys ?? current.command ?? `${current.app}: ${current.action}`;
          setFlash(onCopy(text) ? "✓ copied!" : "✗ copy failed");
        }
        return;
      }
      if ((key.meta && (key.backspace || key.delete)) || (key.ctrl && input === "w")) {
        setQuery(deleteWordBack);
        setSelected(0);
        return;
      }
      if (key.ctrl && input === "u") {
        setQuery("");
        setSelected(0);
        return;
      }
      if (key.backspace || key.delete) {
        setQuery((q) => q.slice(0, -1));
        setSelected(0);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setQuery((q) => q + input);
        setSelected(0);
      }
    },
    { isActive: mode === "search" },
  );

  const existingTags = [...new Set(entries.flatMap((e) => e.tags ?? []))].sort();

  if (mode === "filter") {
    return (
      <FilterPicker
        apps={[...new Set(entries.map((e) => e.app))].sort()}
        height={listHeight}
        width={left}
        onSelect={(f: Filter) => {
          setFilter(f);
          setSelected(0);
          setMode("search");
        }}
        onCancel={() => setMode("search")}
      />
    );
  }

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
        initialFocus={1}
        initial={entryToDraft(editTarget.app, editTarget)}
        title={`Edit entry — ${editTarget.app}`}
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

  return (
    <Box flexDirection="column">
      <SearchInput
        query={query}
        filterLabel={
          filter.type === "app"
            ? `(filter: ${filter.app})`
            : filter.type === "favorites"
              ? "(★ Favorites)"
              : undefined
        }
      />
      <Box>
        <ResultList
          results={results}
          selected={sel}
          query={query}
          height={listHeight}
          width={left}
          favorites={favorites}
          emptyMessage={
            filter.type === "favorites" ? "No favorites yet — ⌃S stars an entry." : undefined
          }
        />
        <PreviewPane entry={current} width={right} />
      </Box>
      <Footer
        flash={flash}
        errorCount={errorCount}
        resultCount={results.length}
        filterActive={filter.type !== "all"}
        confirm={
          pendingDelete ? `Delete '${pendingDelete.app}: ${pendingDelete.action}'?` : undefined
        }
      />
    </Box>
  );
}
