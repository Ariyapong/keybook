import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  target: "node22",
  platform: "node",
  clean: true,
  dts: false,
  // Keep the .js extension so package.json `bin` and the Homebrew formula
  // (which symlinks bin/*) match v0.1/v0.2 output. tsdown defaults to .mjs.
  outExtensions: () => ({ js: ".js" }),
  banner: { js: "#!/usr/bin/env node" },
});
