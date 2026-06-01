import { beforeEach, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));
import { spawnSync } from "node:child_process";
import { copyToClipboard } from "../src/clipboard";

beforeEach(() => vi.mocked(spawnSync).mockReset());

it("returns true and pipes text to pbcopy on success", () => {
  vi.mocked(spawnSync).mockReturnValue({ status: 0 } as never);
  expect(copyToClipboard("hello")).toBe(true);
  expect(spawnSync).toHaveBeenCalledWith("pbcopy", { input: "hello" });
});

it("returns false when pbcopy is unavailable", () => {
  vi.mocked(spawnSync).mockImplementation(() => {
    throw new Error("ENOENT");
  });
  expect(copyToClipboard("hello")).toBe(false);
});

it("returns false on a non-zero exit", () => {
  vi.mocked(spawnSync).mockReturnValue({ status: 1 } as never);
  expect(copyToClipboard("hello")).toBe(false);
});
