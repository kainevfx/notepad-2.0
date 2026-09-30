// Sorting a grid by clicking its column headers: a view only, the file keeps its order.

export type SortState = { col: number; dir: 'asc' | 'desc' } | null;

/** asc -> desc -> file order; another column starts at asc. */
export function nextSort(s: SortState, col: number): SortState {
  if (!s || s.col !== col) return { col, dir: 'asc' };
  return s.dir === 'asc' ? { col, dir: 'desc' } : null;
}

/** A number, allowing a currency sign, thousands separators and a trailing %. */
function toNum(v: string): number | null {
  const t = v.trim().replace(/^[£$€¥]/, '').replace(/[, ]/g, '').replace(/%$/, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Sorted copy of the data rows (header not included); blanks always last. */
export function sortRows(rows: string[][], s: SortState): string[][] {
  if (!s) return rows;
  const sign = s.dir === 'asc' ? 1 : -1;
  const idx = rows.map((_, i) => i);
  idx.sort((a, b) => {
    const x = rows[a][s.col] ?? '';
    const y = rows[b][s.col] ?? '';
    if (!x.trim() || !y.trim()) return !x.trim() && !y.trim() ? a - b : !x.trim() ? 1 : -1;
    const nx = toNum(x);
    const ny = toNum(y);
    const c = nx !== null && ny !== null ? nx - ny : x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' });
    return c ? c * sign : a - b;
  });
  return idx.map((i) => rows[i]);
}
