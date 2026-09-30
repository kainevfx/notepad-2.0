// CSV / TSV (RFC 4180): quoted fields with doubled quotes, delimiters and line breaks inside
// quotes, CRLF or LF rows. Used by the table viewer and by Save sheet as CSV.

export const MAX_GRID_CELLS = 200_000;

export function parseCsv(text: string, delim: string, maxCells = MAX_GRID_CELLS): { rows: string[][]; truncated: boolean } {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let cells = 0;
  let truncated = false;
  const endRow = () => {
    row.push(field);
    field = '';
    if (cells + row.length > maxCells) {
      truncated = true;
      return false;
    }
    cells += row.length;
    rows.push(row);
    row = [];
    return true;
  };
  let i = 0;
  for (; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      if (!endRow()) break;
    } else field += c;
  }
  if (!truncated && (field !== '' || row.length)) endRow();
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  for (const r of rows) while (r.length < width) r.push('');
  return { rows, truncated };
}

/** Delimiters counted outside quotes, per line. */
function countsPerLine(lines: string[], d: string): number[] {
  return lines.map((line) => {
    let n = 0;
    let q = false;
    for (const c of line) {
      if (c === '"') q = !q;
      else if (c === d && !q) n++;
    }
    return n;
  });
}

export function detectDelimiter(text: string, path: string | null): ',' | ';' | '\t' {
  if (path && /\.tsv$/i.test(path)) return '\t';
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
  let best: { d: ',' | ';' | '\t'; min: number; spread: number } = { d: ',', min: 0, spread: Infinity };
  for (const d of [',', ';', '\t'] as const) {
    const c = countsPerLine(lines, d);
    if (!c.length) continue;
    const min = Math.min(...c);
    const spread = Math.max(...c) - min;
    if (min > best.min || (min === best.min && min > 0 && spread < best.spread)) best = { d, min, spread };
  }
  return best.min > 0 ? best.d : ',';
}

export function toCsv(rows: string[][]): string {
  const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
