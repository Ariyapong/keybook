import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { FormFields } from "../src/tui/FormFields";
import { ReviewScreen } from "../src/tui/ReviewScreen";
import { emptyDraft } from "../src/tui/useAddForm";

describe("FormFields", () => {
  it("shows the live glyph preview for keys", () => {
    const draft = { ...emptyDraft, app: "Fork", type: "shortcut" as const, keys: "shift cmd p" };
    const { lastFrame } = render(
      <FormFields draft={draft} apps={["Fork"]} appIndex={0} focused={3} />,
    );
    expect(lastFrame() ?? "").toContain("⇧⌘P");
  });

  it("hints at existing tags when the Tags field is focused", () => {
    const draft = { ...emptyDraft, app: "Fork", type: "shortcut" as const };
    const { lastFrame } = render(
      <FormFields
        draft={draft}
        apps={["Fork"]}
        appIndex={0}
        focused={4}
        existingTags={["push", "pull"]}
      />,
    );
    expect(lastFrame() ?? "").toContain("push");
  });

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
});

describe("ReviewScreen", () => {
  it("renders the entry as keycaps and the target path", () => {
    const { lastFrame } = render(
      <ReviewScreen
        app="Fork"
        entry={{ action: "Push", keys: "⇧⌘P" }}
        targetPath="/x/fork.yaml"
        error=""
      />,
    );
    const out = lastFrame() ?? "";
    expect(out).toContain("Push");
    expect(out).toContain("⇧");
    expect(out).toContain("fork.yaml");
  });
});
