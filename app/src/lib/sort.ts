// Sidebar sorting (a view only: the stored manual order is never changed) and "last edited" labels.
import type { TreeNode, GroupNode } from './tree-ops';

export type SortMode = 'manual' | 'modified' | 'created' | 'name' | 'type';

export const SORT_LABELS: Record<SortMode, string> = {
  manual: 'Manual',
  modified: 'Date modified',
  created: 'Date created',
  name: 'Name A–Z',
  type: 'File type',
};

export interface SortDoc {
  title: string;
  created: number;
  modified: number;
  language: 'plain' | 'markdown';
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });

function noteCompare(mode: SortMode, docs: Record<string, SortDoc>) {
  return (x: TreeNode, y: TreeNode): number => {
    const a = docs[x.id];
    const b = docs[y.id];
    if (!a || !b) return 0;
    switch (mode) {
      case 'modified': return b.modified - a.modified;
      case 'created': return b.created - a.created;
      case 'name': return byName(a.title, b.title);
      case 'type': return (a.language === b.language ? 0 : a.language === 'plain' ? -1 : 1) || byName(a.title, b.title);
      default: return 0;
    }
  };
}

/** A sorted copy of the tree for display. Ungrouped files stay above groups. */
export function sortNodes(nodes: TreeNode[], mode: SortMode, docs: Record<string, SortDoc>): TreeNode[] {
  if (mode === 'manual') return nodes;
  const notes = nodes.filter((n) => n.kind === 'note').sort(noteCompare(mode, docs));
  const groups = nodes
    .filter((n): n is GroupNode => n.kind === 'group')
    .map((g) => ({ ...g, children: sortNodes(g.children, mode, docs) }));
  if (mode === 'name') groups.sort((a, b) => byName(a.name, b.name));
  return [...notes, ...groups];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "just now", "5 min ago", "09:05", "Yesterday 18:40", "Mon 3 Aug", "28 Sep 2025". */
export function relativeTime(ts: number, now: number): string {
  const diff = now - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  const d = new Date(ts);
  const n = new Date(now);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, n)) return hm;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (sameDay(d, y)) return `Yesterday ${hm}`;
  if (d.getFullYear() === n.getFullYear()) return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
