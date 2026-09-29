import { describe, expect, it } from 'vitest';
import * as T from './tree-ops';
import {
  TreeNode, GroupNode, move, canMove, createGroup, ungroup, flattenNotes, visibleNotes, find,
  setCollapsedDeep, effectiveAutosave, MAX_GROUP_DEPTH, moveToRoot, update,
} from './tree-ops';

const note = (id: string): TreeNode => ({ id, kind: 'note' });
const group = (id: string, children: TreeNode[], extra: Partial<GroupNode> = {}): GroupNode => ({
  id, kind: 'group', name: id, color: 'blue', collapsed: false, children, ...extra,
});

const base = (): TreeNode[] => [
  group('A', [note('a1'), note('a2'), group('A1', [note('a11')])]),
  group('B', [note('b1')]),
  note('loose'),
];

describe('tree-ops', () => {
  it('flattens notes in order', () => {
    expect(flattenNotes(base())).toEqual(['a1', 'a2', 'a11', 'b1', 'loose']);
  });
  it('visibleNotes skips collapsed groups', () => {
    const t = update(base(), 'A1', { collapsed: true });
    expect(visibleNotes(t)).toEqual(['a1', 'a2', 'b1', 'loose']);
  });
  it('reorders a note before another', () => {
    const t = move(base(), 'a2', 'a1', 'before')!;
    expect(flattenNotes(t).slice(0, 2)).toEqual(['a2', 'a1']);
  });
  it('drops a note into a group', () => {
    const t = move(base(), 'loose', 'B', 'inside')!;
    expect(find(t, 'loose')!.parent!.id).toBe('B');
  });
  it('drags a note out of a group to the top level', () => {
    const t = move(base(), 'a1', 'loose', 'after')!;
    expect(find(t, 'a1')!.parent).toBeNull();
    const t2 = moveToRoot(base(), 'a11')!;
    expect(find(t2, 'a11')!.parent).toBeNull();
  });
  it('nests a group into a sibling', () => {
    const t = move(base(), 'B', 'A', 'inside')!;
    expect(find(t, 'B')!.parent!.id).toBe('A');
  });
  it('rejects dropping a group into its own descendant', () => {
    expect(canMove(base(), 'A', 'A1', 'inside')).toBe(false);
    expect(move(base(), 'A', 'a11', 'before')).toBeNull();
    expect(move(base(), 'A', 'A', 'inside')).toBeNull();
  });
  it('rejects dropping inside a note', () => {
    expect(canMove(base(), 'a1', 'b1', 'inside')).toBe(false);
  });
  it('caps nesting depth', () => {
    let t: TreeNode[] = [group('g1', [group('g2', [group('g3', [group('g4', [note('deep')])])])]), group('x', [])];
    expect(canMove(t, 'x', 'g4', 'inside')).toBe(false); // would be level 5
    expect(canMove(t, 'x', 'g3', 'inside')).toBe(true); // level 4
    expect(canMove(t, 'deep', 'g4', 'inside')).toBe(true); // notes are not levels
    t = [group('two', [group('two-b', [])]), group('g1', [group('g2', [group('g3', [])])])];
    expect(canMove(t, 'two', 'g3', 'inside')).toBe(false);
    expect(MAX_GROUP_DEPTH).toBe(4);
  });
  it('keeps system groups at the top level', () => {
    const t: TreeNode[] = [group('q', [], { system: 'quick-notes' }), group('A', [])];
    expect(canMove(t, 'q', 'A', 'inside')).toBe(false);
    expect(canMove(t, 'q', 'A', 'after')).toBe(true);
  });
  it('creates a group from notes at the first note position', () => {
    const t = createGroup(base(), { id: 'N', name: 'New', color: 'green', collapsed: false }, ['loose', 'b1'])!;
    const n = find(t, 'N')!;
    expect(n.parent).toBeNull();
    expect((n.node as GroupNode).children.map((c) => c.id)).toEqual(['loose', 'b1']);
  });
  it('creating a group from a note inside a group makes a subgroup', () => {
    const t = createGroup(base(), { id: 'S', name: 'Sub', color: 'red', collapsed: false }, ['a2'])!;
    expect(find(t, 'S')!.parent!.id).toBe('A');
    expect(find(t, 'a2')!.parent!.id).toBe('S');
  });
  it('creates an empty subgroup under a parent', () => {
    const t = createGroup(base(), { id: 'S', name: 'Sub', color: 'red', collapsed: false }, [], 'B')!;
    expect(find(t, 'S')!.parent!.id).toBe('B');
  });
  it('ungroups in place', () => {
    const t = ungroup(base(), 'A');
    expect(t.map((n) => n.id)).toEqual(['a1', 'a2', 'A1', 'B', 'loose']);
  });
  it('collapses a group and everything under it', () => {
    const t = setCollapsedDeep(base(), 'A', true);
    expect((find(t, 'A1')!.node as GroupNode).collapsed).toBe(true);
    expect((find(t, 'B')!.node as GroupNode).collapsed).toBe(false);
  });
  it('resolves autosave overrides from the nearest group', () => {
    let t = update(base(), 'A', { autosave: true });
    expect(effectiveAutosave(t, 'a11', false)).toBe(true);
    t = update(t, 'A1', { autosave: false });
    expect(effectiveAutosave(t, 'a11', true)).toBe(false);
    expect(effectiveAutosave(t, 'loose', false)).toBe(false);
  });
  it('does not mutate the input', () => {
    const t = base();
    const snapshot = JSON.stringify(t);
    move(t, 'a1', 'B', 'inside');
    createGroup(t, { id: 'Z', name: 'z', color: 'grey', collapsed: false }, ['loose']);
    ungroup(t, 'A');
    expect(JSON.stringify(t)).toBe(snapshot);
  });
});

describe('normalizeLooseFirst', () => {
  const n = (id: string): T.TreeNode => ({ id, kind: 'note' });
  const g = (id: string, children: T.TreeNode[] = []): T.TreeNode => ({ id, kind: 'group', name: id, color: 'blue', collapsed: false, children });
  it('moves ungrouped files above groups, keeping each side in order', () => {
    const out = T.normalizeLooseFirst([g('g1'), n('n1'), g('g2'), n('n2')]);
    expect(out.map((x) => x.id)).toEqual(['n1', 'n2', 'g1', 'g2']);
  });
  it('returns the same array when already in order', () => {
    const t = [n('n1'), g('g1')];
    expect(T.normalizeLooseFirst(t)).toBe(t);
  });
  it('leaves the order inside groups alone', () => {
    const out = T.normalizeLooseFirst([g('g1', [g('s'), n('a')])]);
    expect((out[0] as T.GroupNode).children.map((x) => x.id)).toEqual(['s', 'a']);
  });
});
