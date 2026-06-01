import { z } from "zod";

// Key-notation convention (for keys strings): macOS glyphs —
// ⌘ Command, ⌥ Option, ⌃ Control, ⇧ Shift, ⏎ Return, ⎋ Escape, ⌫ Delete, ␣ Space.
// Chord sequences use a comma, e.g. "⌃B, %".

export const entrySchema = z
  .object({
    action: z.string().min(1),
    keys: z.string().min(1).optional(),
    steps: z.array(z.string().min(1)).min(1).optional(),
    command: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).optional(),
    notes: z.string().min(1).optional(),
    source: z.string().min(1).optional(),
  })
  .strict()
  .refine((e) => Boolean(e.keys) || Boolean(e.steps) || Boolean(e.command), {
    message: "entry must have at least one of: keys, steps, command",
  });

export const fileShape = z
  .object({
    app: z.string().min(1),
    entries: z.array(z.unknown()).min(1),
  })
  .strict();
