import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { favKey } from "../src/data/favorites";
import type { LoadedEntry } from "../src/data/types";
import { ResultList } from "../src/tui/ResultList";

const E = (app: string, action: string, keys?: string): LoadedEntry => ({
  app,
  action,
  keys,
  file: `${app}.yaml`,
  index: 0,
});

describe("ResultList", () => {
  it("renders a ★ on favorited rows and a blank slot otherwise", () => {
    const results = [E("Fork", "Force push", "⇧⌘P"), E("VS Code", "Command Palette", "⌘⇧P")];
    const favorites = new Set([favKey("Fork", "Force push")]);
    const { lastFrame } = render(
      <ResultList results={results} selected={0} query="" favorites={favorites} />,
    );
    const out = lastFrame() ?? "";
    expect(out).toContain("★ Fork · Force push");
    expect(out).toContain("VS Code · Command Palette");
    expect(out).not.toContain("★ VS Code");
  });

  it("shows the custom empty message when there are no results", () => {
    const { lastFrame } = render(
      <ResultList
        results={[]}
        selected={0}
        query=""
        emptyMessage="No favorites yet — ⌃S stars an entry."
      />,
    );
    expect(lastFrame() ?? "").toContain("No favorites yet");
  });

  it("falls back to the no-matches message without an emptyMessage", () => {
    const { lastFrame } = render(<ResultList results={[]} selected={0} query="zzz" />);
    expect(lastFrame() ?? "").toContain('No matches for "zzz"');
  });
});
