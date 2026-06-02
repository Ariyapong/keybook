import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { tmpDataDir } from "./_helpers";

const CLI = "dist/cli.js";

beforeAll(() => {
  execFileSync("pnpm", ["build"], { stdio: "ignore" });
}, 120_000);

describe("keybook CLI (built)", () => {
  it("`path` prints the env-provided data dir", () => {
    const out = execFileSync("node", ["dist/cli.js", "path"], {
      env: { ...process.env, KEYBOOK_DATA_DIR: "/tmp/keybook-demo" },
      encoding: "utf8",
    });
    expect(out).toContain("/tmp/keybook-demo");
    expect(out).toContain("env");
  });

  it("`check` seeds a fresh dir and validates it (exit 0)", () => {
    const dir = join(mkdtempSync(join(tmpdir(), "kb-int-")), "data");
    const out = execFileSync("node", ["dist/cli.js", "check"], {
      env: { ...process.env, KEYBOOK_DATA_DIR: dir },
      encoding: "utf8",
    });
    expect(out).toContain("OK");
  });

  it("`--version` matches package.json", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    const out = execFileSync("node", ["dist/cli.js", "--version"], { encoding: "utf8" }).trim();
    expect(out).toBe(pkg.version);
  });

  it("add (flag mode) writes an entry and check passes", () => {
    const dir = tmpDataDir({
      "fork.yaml": 'app: Fork\nentries:\n  - action: Pull\n    keys: "⇧⌘L"\n',
    });
    execFileSync(
      "node",
      [CLI, "add", "--app", "Fork", "--action", "Push", "--keys", "shift cmd p"],
      {
        env: { ...process.env, KEYBOOK_DATA_DIR: dir },
      },
    );
    const out = execFileSync("node", [CLI, "check"], {
      env: { ...process.env, KEYBOOK_DATA_DIR: dir },
      encoding: "utf8",
    });
    expect(out).toMatch(/entries OK/);
  });

  it("add with a missing required field exits 2 and names it (non-TTY)", () => {
    const dir = tmpDataDir({});
    let code = 0;
    let stderr = "";
    try {
      execFileSync("node", [CLI, "add", "--app", "Fork", "--keys", "x"], {
        env: { ...process.env, KEYBOOK_DATA_DIR: dir },
        encoding: "utf8",
      });
    } catch (e) {
      code = (e as { status: number }).status;
      stderr = String((e as { stderr: string }).stderr);
    }
    expect(code).toBe(2);
    expect(stderr).toMatch(/action/);
  });
});
