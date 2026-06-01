import { describe, expect, it } from "vitest";
import { loadEntries } from "../src/data/loader";
import { tmpDataDir } from "./_helpers";

describe("loadEntries", () => {
  it("loads entries and injects the file-level app", () => {
    const dir = tmpDataDir({ "finder.yaml": 'app: Finder\nentries:\n  - action: New tab\n    keys: "⌘T"\n' });
    const { entries, errors } = loadEntries(dir);
    expect(errors).toHaveLength(0);
    expect(entries[0]).toMatchObject({ app: "Finder", action: "New tab", keys: "⌘T" });
  });

  it("skips a bad entry but keeps the good ones", () => {
    const dir = tmpDataDir({
      "x.yaml": 'app: X\nentries:\n  - action: Good\n    keys: "A"\n  - action: Bad\n',
    });
    const { entries, errors } = loadEntries(dir);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.action).toBe("Good");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ file: "x.yaml", entryIndex: 1 });
  });

  it("reports a YAML parse error without throwing", () => {
    const dir = tmpDataDir({ "broken.yaml": "app: X\nentries: [unclosed" });
    const { errors } = loadEntries(dir);
    expect(errors[0]?.file).toBe("broken.yaml");
    expect(errors[0]?.entryIndex).toBeNull();
  });

  it("returns an error (not a throw) for a missing dir", () => {
    const { errors } = loadEntries("/no/such/keybook/dir");
    expect(errors).toHaveLength(1);
  });
});
