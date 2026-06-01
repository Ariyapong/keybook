import { Box, useApp, useStdin } from "ink";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
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

/** Minimal key info derived from raw stdin data. */
interface Key {
  upArrow: boolean;
  downArrow: boolean;
  return: boolean;
  escape: boolean;
  backspace: boolean;
  delete: boolean;
  ctrl: boolean;
  meta: boolean;
}

function parseRaw(data: string): { input: string; key: Key } {
  const key: Key = {
    upArrow: false,
    downArrow: false,
    return: false,
    escape: false,
    backspace: false,
    delete: false,
    ctrl: false,
    meta: false,
  };

  if (data === "\r" || data === "\n") {
    key.return = true;
    return { input: "", key };
  }
  if (data === "\x1b" || data === "\x1b\x1b") {
    key.escape = true;
    key.meta = data.length === 2;
    return { input: "", key };
  }
  if (data === "\b" || data === "\x1b\b") {
    key.backspace = true;
    key.meta = data.charAt(0) === "\x1b";
    return { input: "", key };
  }
  if (data === "\x7f" || data === "\x1b\x7f") {
    key.delete = true;
    key.meta = data.charAt(0) === "\x1b";
    return { input: "", key };
  }
  // Escape sequences for arrow keys
  if (data === "\x1b[A") { key.upArrow = true; return { input: "", key }; }
  if (data === "\x1b[B") { key.downArrow = true; return { input: "", key }; }
  // ctrl+letter: code points 1–26
  if (data.length === 1 && data <= "\x1a") {
    key.ctrl = true;
    const name = String.fromCharCode(data.charCodeAt(0) + "a".charCodeAt(0) - 1);
    return { input: name, key };
  }
  // Printable / multi-char paste
  const input = data.startsWith("\x1b") ? data.slice(1) : data;
  return { input, key };
}

export function App({ entries, errorCount = 0, onCopy = copyToClipboard }: AppProps) {
  const { exit } = useApp();
  const { stdin, setRawMode } = useStdin();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [flash, setFlash] = useState("");

  const results = useMemo(() => search(entries, query), [entries, query]);
  const sel = results.length ? Math.min(selected, results.length - 1) : 0;
  const current = results[sel];

  // Keep a stable ref to all state/callbacks used inside the handler so we can
  // attach a single listener that always sees fresh values without re-attaching.
  const stateRef = useRef({ results, sel, current, onCopy, exit, flash });
  stateRef.current = { results, sel, current, onCopy, exit, flash };

  // useLayoutEffect runs synchronously after React commits, unlike useEffect
  // which is deferred. This ensures the stdin listener is in place before the
  // very first stdin.write() call in tests (which happen right after render()).
  useLayoutEffect(() => {
    setRawMode(true);

    const handler = (data: string) => {
      const { input, key } = parseRaw(String(data));
      const st = stateRef.current;

      // Clear flash on any non-return key
      if (!key.return && st.flash) setFlash("");

      if (key.escape || (key.ctrl && input === "c")) {
        st.exit();
        return;
      }
      if (key.downArrow || (key.ctrl && input === "n")) {
        setSelected((s) => Math.min(s + 1, stateRef.current.results.length - 1));
        return;
      }
      if (key.upArrow || (key.ctrl && input === "p")) {
        setSelected((s) => Math.max(s - 1, 0));
        return;
      }
      if (key.return) {
        if (st.current) {
          const text =
            st.current.keys ?? st.current.command ?? `${st.current.app}: ${st.current.action}`;
          setFlash(st.onCopy(text) ? "✓ copied!" : "✗ copy failed");
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
    };

    stdin.on("data", handler);
    return () => {
      stdin.off("data", handler);
      setRawMode(false);
    };
  }, [stdin, setRawMode]);

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
