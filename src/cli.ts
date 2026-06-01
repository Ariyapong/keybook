import { spawn } from "node:child_process";
import { Command } from "commander";
import { render } from "ink";
import { createElement } from "react";
import { runCheck, runPath } from "./commands";
import { ensureDataDir, resolveDataDir } from "./config";
import { loadEntries } from "./data/loader";
import { App } from "./tui/App";

const program = new Command();
program
  .name("keybook")
  .description("Search keyboard shortcuts & recipes for your apps")
  .version("0.1.0");

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

program.action(() => {
  const { dir } = resolveDataDir();
  const init = ensureDataDir(dir);
  if (init.initialized) console.log(`Initialized ${dir} from seed (${init.fileCount} files).`);
  const { entries, errors } = loadEntries(dir);
  for (const e of errors) console.error(`⚠ ${e.file}: ${e.message}`);
  render(createElement(App, { entries, errorCount: errors.length }));
});

program.parse();
