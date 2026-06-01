import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const YAML_RE = /\.ya?ml$/;

export interface DataDirInfo {
  dir: string;
  source: "env" | "xdg" | "default";
}

export function resolveDataDir(env: NodeJS.ProcessEnv = process.env): DataDirInfo {
  if (env.KEYBOOK_DATA_DIR) return { dir: env.KEYBOOK_DATA_DIR, source: "env" };
  if (env.XDG_CONFIG_HOME) return { dir: join(env.XDG_CONFIG_HOME, "keybook"), source: "xdg" };
  return { dir: join(homedir(), ".config", "keybook"), source: "default" };
}

/** Locate the bundled seed/ relative to this module (works in dist and in tests). */
export function seedDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "seed");
}

export interface InitResult {
  initialized: boolean;
  fileCount: number;
}

export function ensureDataDir(dir: string, seed: string = seedDir()): InitResult {
  const hasYaml = existsSync(dir) && readdirSync(dir).some((f) => YAML_RE.test(f));
  if (hasYaml) return { initialized: false, fileCount: 0 };

  mkdirSync(dir, { recursive: true });
  const seedFiles = readdirSync(seed).filter((f) => YAML_RE.test(f));
  for (const f of seedFiles) cpSync(join(seed, f), join(dir, f));
  return { initialized: true, fileCount: seedFiles.length };
}
