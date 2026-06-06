export interface Entry {
  app: string;
  action: string;
  keys?: string;
  steps?: string[];
  command?: string;
  tags?: string[];
  notes?: string;
  source?: string;
}

export interface LoadedEntry extends Entry {
  file: string; // basename of the source file, e.g. "fork.yaml"
  index: number; // original position in the file's `entries:` array
}

export interface LoadError {
  file: string;
  entryIndex: number | null; // null = file-level error
  message: string;
}

export interface LoadResult {
  entries: LoadedEntry[];
  errors: LoadError[];
}

export type EntryInput = Omit<Entry, "app">;

export interface AddResult {
  ok: boolean;
  file: string; // path written (or attempted); "" before a file is chosen
  created: boolean; // true if a new app file was created
  lines: string[]; // runCheck-style human-readable messages
}
