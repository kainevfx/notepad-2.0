// Which viewer a file opens in, picked from its extension. `text` is the plain / Markdown editor
// as before; binary kinds hold no text and are shown read-only straight from the file.

/** 'large': a data file too big to preview (never picked by extension; shown as a notice). */
export type ViewerKind = 'text' | 'table' | 'sheet' | 'tree' | 'code' | 'html' | 'image' | 'pdf' | 'docx' | 'large';

const BY_EXT: Record<string, ViewerKind> = {
  csv: 'table', tsv: 'table',
  xlsx: 'sheet', xls: 'sheet', ods: 'sheet',
  json: 'tree', yaml: 'tree', yml: 'tree', xml: 'tree',
  toml: 'code', log: 'code', ini: 'code', cfg: 'code', conf: 'code',
  html: 'html', htm: 'html',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', ico: 'image',
  pdf: 'pdf',
  docx: 'docx',
};

/** Files bigger than this are not previewed (Open in default app instead). */
export const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;

export function viewKindFor(path: string | null): ViewerKind {
  const ext = path && /\.([^.\\/]+)$/.exec(path)?.[1]?.toLowerCase();
  return (ext && BY_EXT[ext]) || 'text';
}

/** Shown straight from the file: read-only, no text buffer, never autosaved. */
export const isBinaryKind = (k?: ViewerKind) => k === 'sheet' || k === 'image' || k === 'pdf' || k === 'docx' || k === 'large';

/** Text files with a formatted View next to their Source. */
export const hasViewPane = (k?: ViewerKind) => k === 'table' || k === 'tree' || k === 'html';

export function formatBytes(n?: number): string {
  if (n == null) return '';
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
