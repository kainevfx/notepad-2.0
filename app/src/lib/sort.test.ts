import { describe, it, expect } from 'vitest';
import { sortNodes, relativeTime, type SortDoc } from './sort';
import type { TreeNode } from './tree-ops';

const n = (id: string): TreeNode => ({ id, kind: 'note' });
const g = (id: string, name: string, children: TreeNode[]): TreeNode => ({ id, kind: 'group', name, color: 'blue', collapsed: false, children });

const docs: Record<string, SortDoc> = {
  a: { title: 'banana', created: 3, modified: 10, language: 'markdown' },
  b: { title: 'Apple', created: 1, modified: 30, language: 'plain' },
  c: { title: 'cherry', created: 2, modified: 20, language: 'markdown' },
  d: { title: 'date', created: 5, modified: 5, language: 'plain' },
};
const tree = (): TreeNode[] => [n('a'), n('b'), n('c'), g('G2', 'zeta', [n('d')]), g('G1', 'alpha', [])];
const ids = (t: TreeNode[]) => t.map((x) => x.id);

describe('sortNodes', () => {
  it('manual returns the stored order untouched', () => {
    const t = tree();
    expect(sortNodes(t, 'manual', docs)).toBe(t);
  });
  it('date modified: newest first', () => expect(ids(sortNodes(tree(), 'modified', docs))).toEqual(['b', 'c', 'a', 'G2', 'G1']));
  it('date created: newest first', () => expect(ids(sortNodes(tree(), 'created', docs))).toEqual(['a', 'c', 'b', 'G2', 'G1']));
  it('name A-Z sorts files and groups, case-insensitive', () => expect(ids(sortNodes(tree(), 'name', docs))).toEqual(['b', 'a', 'c', 'G1', 'G2']));
  it('file type groups text files before Markdown, then by name', () => expect(ids(sortNodes(tree(), 'type', docs))).toEqual(['b', 'a', 'c', 'G2', 'G1']));
  it('sorts inside groups too', () => {
    const t = [g('G', 'g', [n('a'), n('b')])];
    expect(ids((sortNodes(t, 'modified', docs)[0] as any).children)).toEqual(['b', 'a']);
  });
  it('never mutates the stored tree', () => {
    const t = tree();
    const before = JSON.stringify(t);
    sortNodes(t, 'name', docs);
    sortNodes(t, 'modified', docs);
    expect(JSON.stringify(t)).toBe(before);
  });
});

describe('relativeTime', () => {
  const now = new Date(2026, 8, 29, 15, 30).getTime(); // Tue 29 Sep 2026 15:30
  it('just now', () => expect(relativeTime(now - 30_000, now)).toBe('just now'));
  it('minutes', () => expect(relativeTime(now - 5 * 60_000, now)).toBe('5 min ago'));
  it('earlier today', () => expect(relativeTime(new Date(2026, 8, 29, 9, 5).getTime(), now)).toBe('09:05'));
  it('yesterday', () => expect(relativeTime(new Date(2026, 8, 28, 18, 40).getTime(), now)).toBe('Yesterday 18:40'));
  it('this year', () => expect(relativeTime(new Date(2026, 7, 3, 12, 0).getTime(), now)).toBe('Mon 3 Aug'));
  it('older', () => expect(relativeTime(new Date(2025, 8, 28, 12, 0).getTime(), now)).toBe('28 Sep 2025'));
});
