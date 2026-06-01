import { spawnSync } from "node:child_process";

/** Copy text to the macOS clipboard via pbcopy. Returns false if it fails. */
export function copyToClipboard(text: string): boolean {
  try {
    const res = spawnSync("pbcopy", { input: text });
    return res.status === 0;
  } catch {
    return false;
  }
}
