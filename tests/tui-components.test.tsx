import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import type { Entry } from "../src/data/types";
import { Footer } from "../src/tui/Footer";
import { PreviewPane } from "../src/tui/PreviewPane";
import { ResultRow } from "../src/tui/ResultRow";

describe("ResultRow", () => {
  it("shows app, action, and the keys", () => {
    const e: Entry = { app: "Finder", action: "New tab", keys: "⌘T" };
    const { lastFrame } = render(<ResultRow entry={e} selected={false} />);
    expect(lastFrame()).toContain("Finder");
    expect(lastFrame()).toContain("New tab");
    expect(lastFrame()).toContain("⌘T");
  });
  it("shows a recipe badge when there are no keys", () => {
    const e: Entry = { app: "Finder", action: "X", steps: ["a"] };
    const { lastFrame } = render(<ResultRow entry={e} selected={false} />);
    expect(lastFrame()).toContain("recipe");
  });
});

describe("PreviewPane", () => {
  it("renders keys as caps", () => {
    const e: Entry = { app: "Finder", action: "New tab", keys: "⌘T" };
    const { lastFrame } = render(<PreviewPane entry={e} />);
    expect(lastFrame()).toContain("⌘");
    expect(lastFrame()).toContain("T");
  });
  it("renders recipe steps and command", () => {
    const e: Entry = { app: "Finder", action: "X", steps: ["Step one"], command: "open ." };
    const { lastFrame } = render(<PreviewPane entry={e} />);
    expect(lastFrame()).toContain("1. Step one");
    expect(lastFrame()).toContain("$ open .");
  });
  it("renders nothing for an undefined entry", () => {
    const { lastFrame } = render(<PreviewPane entry={undefined} />);
    expect(lastFrame()).toBe("");
  });
});

describe("Footer", () => {
  it("shows the flash message when present", () => {
    const { lastFrame } = render(<Footer flash="✓ copied!" errorCount={0} resultCount={3} />);
    expect(lastFrame()).toContain("✓ copied!");
  });
  it("shows the skipped-entries warning when there are load errors", () => {
    const { lastFrame } = render(<Footer flash="" errorCount={2} resultCount={3} />);
    expect(lastFrame()).toContain("2");
    expect(lastFrame()).toContain("keybook check");
  });
});
