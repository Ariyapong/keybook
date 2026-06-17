import { Box, Text, useInput } from "ink";
import { useMemo, useState } from "react";

export type Filter = { type: "all" } | { type: "app"; app: string } | { type: "favorites" };

export function FilterPicker({
  apps,
  onSelect,
  onCancel,
  height = 16,
  width = 40,
}: {
  apps: string[];
  onSelect: (f: Filter) => void;
  onCancel: () => void;
  height?: number;
  /** Max column width of the overlay. Passed in from the terminal width so
   *  truncation has a bounded column to cut at and the frame never overflows. */
  width?: number;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0); // 0=Favorites, 1=All apps, 2+=apps

  const matchedApps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? apps.filter((a) => a.toLowerCase().includes(q)) : apps;
  }, [apps, query]);

  const total = 2 + matchedApps.length; // 2 pinned scope rows + apps
  const sel = Math.min(selected, Math.max(0, total - 1));

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "f")) return onCancel();
    if (key.downArrow || (key.ctrl && input === "n")) {
      setSelected((s) => Math.min(s + 1, total - 1));
      return;
    }
    if (key.upArrow || (key.ctrl && input === "p")) {
      setSelected((s) => Math.max(s - 1, 0));
      return;
    }
    if (key.return) {
      if (sel === 0) return onSelect({ type: "favorites" });
      if (sel === 1) return onSelect({ type: "all" });
      const app = matchedApps[sel - 2];
      if (app) return onSelect({ type: "app", app });
      return;
    }
    if (key.backspace || key.delete) {
      setQuery((q) => q.slice(0, -1));
      setSelected(0);
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setQuery((q) => q + input);
      setSelected(2); // jump highlight to the first matching app
    }
  });

  // Window only the app rows; the 2 scope rows are pinned above them.
  const bodyHeight = Math.max(1, height - 2);
  const appSel = Math.max(0, sel - 2);
  const startApp =
    matchedApps.length > bodyHeight
      ? Math.max(0, Math.min(appSel - Math.floor(bodyHeight / 2), matchedApps.length - bodyHeight))
      : 0;
  const visibleApps = matchedApps.slice(startApp, startApp + bodyHeight);

  const row = (text: string, idx: number) => {
    const isSel = idx === sel;
    // wrap="truncate-end" keeps each row on a single line so the frame height
    // stays fixed during interactive redraws (same invariant as ResultRow/Footer).
    return (
      <Text
        key={`${idx}:${text}`}
        wrap="truncate-end"
        color={isSel ? "cyan" : undefined}
        inverse={isSel}
      >
        {isSel ? "▸ " : "  "}
        {text}
      </Text>
    );
  };

  return (
    // width caps the overlay so truncation has a bounded column and the frame
    // cannot grow wider than the terminal (same reasoning as columnWidths in layout.ts).
    <Box flexDirection="column" borderStyle="round" paddingX={1} width={width}>
      <Text wrap="truncate-end" color="cyan">
        Filter by app
      </Text>
      <Text wrap="truncate-end">
        {query ? query : <Text color="gray">type to filter…</Text>}
        <Text inverse> </Text>
      </Text>
      {row("★ Favorites", 0)}
      {row("All apps", 1)}
      <Text wrap="truncate-end" color="gray">
        ──────────────
      </Text>
      {startApp > 0 ? (
        <Text wrap="truncate-end" color="gray">
          {" "}
          ↑ more
        </Text>
      ) : null}
      {visibleApps.map((app, i) => row(app, startApp + i + 2))}
      {startApp + bodyHeight < matchedApps.length ? (
        <Text wrap="truncate-end" color="gray">
          {" "}
          ↓ more
        </Text>
      ) : null}
      <Text wrap="truncate-end" color="gray">
        ↑↓ move ⏎ select ⎋ cancel
      </Text>
    </Box>
  );
}
