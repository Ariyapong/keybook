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

export interface LoadError {
  file: string;
  entryIndex: number | null; // null = file-level error
  message: string;
}

export interface LoadResult {
  entries: Entry[];
  errors: LoadError[];
}
