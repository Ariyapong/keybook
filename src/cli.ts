import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { render } from "ink";
import { createElement } from "react";
import { runAdd, runCheck, runPath } from "./commands";
import { ensureDataDir, resolveDataDir } from "./config";
import { loadEntries } from "./data/loader";
import type { AddResult, EntryInput } from "./data/types";
import { addEntry, listApps } from "./data/writer";
import { AddEntryForm } from "./tui/AddEntryForm";
import { App } from "./tui/App";

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };

const program = new Command();
program
  .name("keybook")
  .description("Search keyboard shortcuts & recipes for your apps")
  .version(pkg.version);

program
  .command("path")
  .description("Print the data directory")
  .action(() => {
    console.log(runPath());
  });

program
  .command("edit")
  .description("Open the data directory in $EDITOR")
  .action(() => {
    const { dir } = resolveDataDir();
    ensureDataDir(dir);
    const editor = process.env.EDITOR || "code";
    const child = spawn(editor, [dir], { stdio: "inherit" });
    child.on("error", () => spawn("open", [dir], { stdio: "inherit" }));
  });

program
  .command("check")
  .description("Validate all data files")
  .action(() => {
    const { dir } = resolveDataDir();
    ensureDataDir(dir);
    const result = runCheck(dir);
    for (const line of result.lines) (result.ok ? console.log : console.error)(line);
    process.exit(result.ok ? 0 : 1);
  });

program
  .command("add")
  .description("Add a new entry (interactive, or non-interactive with flags)")
  .option("--app <name>", "target app")
  .option("--action <text>", "what the entry does")
  .option("--keys <combo>", "key combo (glyphs or words, e.g. 'shift cmd p')")
  .option("--command <cmd>", "terminal command")
  .option("--step <text...>", "recipe step (repeatable)")
  .option("--tags <list>", "comma-separated tags")
  .option("--notes <text>", "notes")
  .action((opts: Record<string, string | string[] | undefined>) => {
    const { dir } = resolveDataDir();
    ensureDataDir(dir);

    const app = opts.app as string | undefined;
    const action = opts.action as string | undefined;
    const keys = opts.keys as string | undefined;
    const command = opts.command as string | undefined;
    const steps = (opts.step as string[] | undefined) ?? undefined;
    const tags =
      typeof opts.tags === "string"
        ? opts.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined;
    const notes = opts.notes as string | undefined;

    const haveBody = Boolean(keys || command || steps?.length);
    const complete = Boolean(app && action && haveBody);

    if (complete) {
      const result = runAdd(dir, {
        app: app as string,
        action: action as string,
        keys,
        command,
        steps,
        tags,
        notes,
      });
      for (const line of result.lines) (result.ok ? console.log : console.error)(line);
      process.exit(result.ok ? 0 : 1);
    }

    if (!process.stdout.isTTY) {
      const missing = [
        !app && "--app",
        !action && "--action",
        !haveBody && "--keys/--command/--step",
      ]
        .filter(Boolean)
        .join(", ");
      console.error(`Error: missing required field(s): ${missing}`);
      process.exit(2);
    }

    const { entries } = loadEntries(dir);
    const existingTags = [...new Set(entries.flatMap((e) => e.tags ?? []))].sort();
    const instance = render(
      createElement(AddEntryForm, {
        apps: listApps(dir),
        existingTags,
        onSubmit: (a: string, entry: EntryInput) => addEntry(dir, a, entry),
        onComplete: (result: AddResult) => {
          for (const line of result.lines) console.log(line);
          instance.unmount();
        },
        onCancel: () => instance.unmount(),
      }),
    );
    instance.waitUntilExit().then(() => process.exit(0));
  });

program.action(() => {
  const { dir } = resolveDataDir();
  const init = ensureDataDir(dir);
  if (init.initialized) console.log(`Initialized ${dir} from seed (${init.fileCount} files).`);
  const { entries, errors } = loadEntries(dir);
  for (const e of errors) console.error(`⚠ ${e.file}: ${e.message}`);
  render(createElement(App, { entries, errorCount: errors.length, dataDir: dir }));
});

program.parse();
