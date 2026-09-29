import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../platform', () => ({ platform: new Proxy({}, { get: () => async () => null }), isTauri: false }));
import { newNote, tree, commitTree, docs, activeId } from './app';
import * as T from '../lib/tree-ops';

const ids = () => tree.value.map((n) => n.id);

beforeEach(() => {
  tree.value = [];
  docs.value = {};
  activeId.value = null;
});

describe('file and group order', () => {
  it('new ungrouped files go to the end of the ungrouped section, above groups', () => {
    const a = newNote({ activate: false });
    commitTree(T.createGroup(tree.value, { id: 'G', name: 'G', color: 'blue', collapsed: false }, [], null));
    const b = newNote({ activate: false });
    const c = newNote({ activate: false });
    expect(ids()).toEqual([a, b, c, 'G']);
  });
  it('a new file created while a grouped file is active goes to the end of that group', () => {
    commitTree(T.createGroup(tree.value, { id: 'G', name: 'G', color: 'blue', collapsed: false }, [], null));
    const first = newNote({ groupId: 'G', activate: false });
    const second = newNote({ groupId: 'G', activate: false });
    activeId.value = first;
    const third = newNote({ activate: false });
    expect((T.find(tree.value, 'G')!.node as T.GroupNode).children.map((n) => n.id)).toEqual([first, second, third]);
  });
  it('any tree written with a file below a group is put back in order', () => {
    const a = newNote({ activate: false });
    commitTree([{ id: 'G', kind: 'group', name: 'G', color: 'blue', collapsed: false, children: [] }, { id: a, kind: 'note' }]);
    expect(ids()).toEqual([a, 'G']);
  });
});
