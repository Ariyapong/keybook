import { Box, useApp, useInput } from "ink";
import { useMemo, useState } from "react";
import { copyToClipboard } from "../clipboard";
import type { Entry } from "../data/types";
import { search } from "../search";
import { Footer } from "./Footer";
import { PreviewPane } from "./PreviewPane";
import { ResultList } from "./ResultList";
import { SearchInput } from "./SearchInput";

export interface AppProps {
  entries: Entry[];
  errorCount?: number;
  onCopy?: (text: string) => boolean;
}

export function App({ entries, errorCount = 0, onCopy = copyToClipboard }: AppProps) {
  const { exit } = useApp();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [flash, setFlash] = useState("");

  const results = useMemo(() => search(entries, query), [entries, query]);
  const sel = results.length ? Math.min(selected, results.length - 1) : 0;
  const current = results[sel];

  useInput((input, key) => {
    if (!key.return && flash) setFlash("");

    if (key.escape || (key.ctrl && input === "c")) {
      exit();
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
    if (key.backspace || key.delete) {
      setQuery((q) => q.slice(0, -1));
      setSelected(0);
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setQuery((q) => q + input);
      setSelected(0);
    }
  });

  return (
    <Box flexDirection="column">
      <SearchInput query={query} />
      <Box>
        <ResultList results={results} selected={sel} />
        <PreviewPane entry={current} />
      </Box>
      <Footer flash={flash} errorCount={errorCount} resultCount={results.length} />
    </Box>
  );
}
