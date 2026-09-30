// The small type pill shown at the end of every tab (TXT, MD, CSV, IMG…).
export type BadgeKind = 'txt' | 'md' | 'other';

const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']);
const ALIAS: Record<string, string> = { yml: 'YAML', htm: 'HTML' };

export function fileBadge(d: { language: 'plain' | 'markdown'; path: string | null }): { label: string; kind: BadgeKind } {
  if (d.language === 'markdown') return { label: 'MD', kind: 'md' };
  const ext = d.path && /\.([^.\\/]+)$/.exec(d.path)?.[1]?.toLowerCase();
  if (!ext || ext === 'txt') return { label: 'TXT', kind: 'txt' };
  if (IMAGE.has(ext)) return { label: 'IMG', kind: 'other' };
  return { label: ALIAS[ext] ?? ext.slice(0, 4).toUpperCase(), kind: 'other' };
}
