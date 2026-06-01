import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

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
});
