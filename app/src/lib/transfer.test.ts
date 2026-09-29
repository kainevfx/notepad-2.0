import { describe, it, expect } from 'vitest';
import { extractItems, importItems, remapIds, windowTitle, sessionKey, windowIndex } from './transfer';
import type { TreeNode, GroupNode } from './tree-ops';

const n = (id: string): TreeNode => ({ id, kind: 'note' });
const g = (id: string, children: TreeNode[]): GroupNode => ({ id, kind: 'group', name: id, color: 'blue', collapsed: false, children });
const ids = (t: TreeNode[]) => t.map((x) => x.id);

const tree = (): TreeNode[] => [n('a'), n('b'), g('G', [n('c'), g('S', [n('d')])]), g('H', [n('e')])];

describe('extractItems', () => {
  it('takes a file out and lists its doc', () => {
    const r = extractItems(tree(), ['b']);
    expect(ids(r.nodes)).toEqual(['b']);
    expect(r.docIds).toEqual(['b']);
    expect(ids(r.rest)).toEqual(['a', 'G', 'H']);
  });
  it('takes a whole subgroup with everything inside', () => {
    const r = extractItems(tree(), ['S']);
    expect(ids(r.nodes)).toEqual(['S']);
    expect(r.docIds).toEqual(['d']);
    expect(ids((r.rest[2] as GroupNode).children)).toEqual(['c']);
  });
  it('keeps tree order and ignores a file already inside a taken group', () => {
    const r = extractItems(tree(), ['H', 'c', 'G']);
    expect(ids(r.nodes)).toEqual(['G', 'H']);
    expect(r.docIds).toEqual(['c', 'd', 'e']);
    expect(ids(r.rest)).toEqual(['a', 'b']);
  });
});

describe('importItems', () => {
  const target = (): TreeNode[] => [n('x'), g('T', [n('y')])];
  it('into Ungrouped: files join the ungrouped files, groups go after the groups', () => {
    const out = importItems(target(), [n('b'), g('G', [n('c')])], { groupId: null });
    expect(ids(out)).toEqual(['x', 'b', 'T', 'G']);
  });
  it('into a file group: at its end', () => {
    const out = importItems(target(), [n('b')], { groupId: 'T' });
    expect(ids((out[1] as GroupNode).children)).toEqual(['y', 'b']);
  });
  it('before a given file inside a group', () => {
    const out = importItems(target(), [n('b')], { groupId: 'T', beforeId: 'y' });
    expect(ids((out[1] as GroupNode).children)).toEqual(['b', 'y']);
  });
  it('an unknown group falls back to Ungrouped', () => {
    expect(ids(importItems(target(), [n('b')], { groupId: 'nope' }))).toEqual(['x', 'b', 'T']);
  });
});

describe('remapIds (copy mode)', () => {
  it('gives every node a new id and reports the mapping', () => {
    let i = 0;
    const { nodes, map } = remapIds([g('G', [n('c')])], () => `new${++i}`);
    expect(nodes[0].id).toBe('new1');
    expect((nodes[0] as GroupNode).children[0].id).toBe('new2');
    expect(map).toEqual({ G: 'new1', c: 'new2' });
  });
});

describe('windows', () => {
  it('window numbers', () => {
    expect(windowIndex('main')).toBe(1);
    expect(windowIndex('main-3')).toBe(3);
  });
  it('titles say which window only when there is more than one', () => {
    expect(windowTitle('notes.txt - Notepad 2.0', 'main', 1)).toBe('notes.txt - Notepad 2.0');
    expect(windowTitle('notes.txt - Notepad 2.0', 'main-2', 2)).toBe('notes.txt - Notepad 2.0 (Window 2)');
  });
  it('each window has its own session file; main keeps the old one', () => {
    expect(sessionKey('main')).toBe('session.json');
    expect(sessionKey('main-2')).toBe('sessions/main-2.json');
  });
});

describe('importItems: a group the target already has', () => {
  it('merges into it instead of adding a second group with the same id (e.g. Quick Notes)', () => {
    const target: TreeNode[] = [g('Q', [n('q1')])];
    const out = importItems(target, [g('Q', [n('q2')]), n('z')], { groupId: null });
    expect(ids(out)).toEqual(['z', 'Q']);
    expect(ids((out[1] as GroupNode).children)).toEqual(['q1', 'q2']);
  });
});
