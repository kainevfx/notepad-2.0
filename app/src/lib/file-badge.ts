// The small TXT / MD pill shown on every tab.
export type BadgeKind = 'txt' | 'md' | 'other';

export function fileBadge(d: { language: 'plain' | 'markdown'; path: string | null }): { label: string; kind: BadgeKind } {
  if (d.language === 'markdown') return { label: 'MD', kind: 'md' };
  const ext = d.path && /\.([^.\\/]+)$/.exec(d.path)?.[1];
  if (!ext || ext.toLowerCase() === 'txt') return { label: 'TXT', kind: 'txt' };
  return { label: ext.slice(0, 4).toUpperCase(), kind: 'other' };
}
