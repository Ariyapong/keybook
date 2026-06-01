// Fixed rows of UI around the result list: 1 (search input) + 2 (footer + its
// top margin) + 1 (trailing-line safety, so the frame never exactly fills the
// terminal and scrolls the top out of reach of Ink's in-place redraw).
export const RESERVED_ROWS = 4;

/**
 * Rows to give the windowed result list, sized to the terminal height so the
 * whole frame fits the viewport. Ink can only redraw in place while the frame
 * stays within the terminal; an oversized frame duplicates on every keypress.
 */
export function visibleListHeight(terminalRows?: number): number {
  const rows = terminalRows && terminalRows > 0 ? terminalRows : 24;
  return Math.max(1, rows - RESERVED_ROWS);
}
