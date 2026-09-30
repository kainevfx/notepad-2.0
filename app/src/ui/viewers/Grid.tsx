// A read-only data grid: sticky header row, row numbers, click a header to sort. Only the rows in
// view are rendered, so 200,000 cells stay smooth.
import { useMemo, useRef, useState, useLayoutEffect } from 'preact/hooks';
import { sortRows, nextSort, type SortState } from '../../lib/grid-sort';
import { MAX_GRID_CELLS } from '../../lib/csv';

const ROW_H = 28;
const OVERSCAN = 40;

export function Grid({ rows, truncated, header = true }: { rows: string[][]; truncated?: boolean; header?: boolean }) {
  const [sort, setSort] = useState<SortState>(null);
  const [top, setTop] = useState(0);
  const [height, setHeight] = useState(600);
  const box = useRef<HTMLDivElement>(null);
  const head = header && rows.length ? rows[0] : null;
  const body = useMemo(() => sortRows(head ? rows.slice(1) : rows, sort), [rows, sort, head]);
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!rows.length) return <div class="grid-empty">This file has no rows.</div>;

  const first = Math.max(0, Math.floor(top / ROW_H) - OVERSCAN);
  const last = Math.min(body.length, Math.ceil((top + height) / ROW_H) + OVERSCAN);
  const cols = Array.from({ length: width }, (_, i) => i);

  return (
    <div class="grid-wrap" ref={box} onScroll={(e) => setTop((e.currentTarget as HTMLDivElement).scrollTop)}>
      <table class="grid">
        {head && (
          <thead>
            <tr>
              <th class="grid-rownum" />
              {cols.map((c) => (
                <th key={c} onClick={() => setSort(nextSort(sort, c))} title="Sort by this column">
                  {head[c] ?? ''}
                  {sort?.col === c && <span class="grid-sort">{sort.dir === 'asc' ? ' ▲' : ' ▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {first > 0 && <tr style={{ height: `${first * ROW_H}px` }} />}
          {body.slice(first, last).map((r, i) => (
            <tr key={first + i}>
              <td class="grid-rownum">{first + i + 1}</td>
              {cols.map((c) => (
                <td key={c} title={(r[c] ?? '').length > 40 ? r[c] : undefined}>
                  {r[c] ?? ''}
                </td>
              ))}
            </tr>
          ))}
          {last < body.length && <tr style={{ height: `${(body.length - last) * ROW_H}px` }} />}
        </tbody>
      </table>
      {truncated && <div class="grid-note">Showing the first {MAX_GRID_CELLS.toLocaleString()} cells.</div>}
    </div>
  );
}
