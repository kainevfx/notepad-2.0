import { describe, it, expect, vi, beforeEach } from 'vitest';

// A tiny in-memory disk.
const disk = new Map<string, Uint8Array>();
const writeFile = vi.fn(async (path: string, bytes: Uint8Array) => {
  disk.set(path, bytes);
  return 1;
});
const fake: Record<string, unknown> = {
  writeFile,
  readFile: async (path: string) => {
    const b = disk.get(path);
    if (!b) throw new Error('missing');
    return { bytes: b, mtime: 1, readonly: false };
  },
  stat: async (path: string) => ({ exists: disk.has(path), mtime: 1, size: 0, readonly: false }),
};
vi.mock('../platform', () => ({
  platform: new Proxy({} as Record<string, unknown>, { get: (_t, k: string) => fake[k] ?? (async () => null) }),
  isTauri: false,
}));

import { docs, tree, activeId, newNote, openFiles, duplicateDoc, copyDoc, pasteInto, commitTree, displayTitle, textOf, renameNote } from './app';
import * as T from '../lib/tree-ops';

const group = (id: string): T.GroupNode => ({ id, kind: 'group', name: id, color: 'blue', collapsed: false, children: [] });
const childIds = (gid: string) => (T.find(tree.value, gid)!.node as T.GroupNode).children.map((c) => c.id);

beforeEach(() => {
  disk.clear();
  writeFile.mockClear();
  docs.value = {};
  tree.value = [];
  activeId.value = null;
});

describe('duplicate', () => {
  it('a note is copied right below itself, in the same file group, named "(2)"', async () => {
    commitTree([group('G')]);
    const a = newNote({ text: 'milk\neggs', groupId: 'G', activate: false });
    renameNote(a, 'Shopping');
    const b = newNote({ text: 'other', groupId: 'G', activate: false });
    const copy = (await duplicateDoc(a))!;
    expect(childIds('G')).toEqual([a, copy, b]);
    expect(displayTitle(docs.value[copy])).toBe('Shopping (2)');
    expect(textOf(copy)).toBe('milk\neggs');
  });

  it('a saved file is copied next to it on disk and never over an existing file', async () => {
    disk.set('C:\\d\\a.txt', new TextEncoder().encode('hello'));
    disk.set('C:\\d\\a (2).txt', new TextEncoder().encode('KEEP'));
    await openFiles(['C:\\d\\a.txt']);
    const orig = Object.values(docs.value)[0].id;
    const copy = (await duplicateDoc(orig))!;
    expect(docs.value[copy].path).toBe('C:\\d\\a (3).txt');
    expect(new TextDecoder().decode(disk.get('C:\\d\\a (2).txt'))).toBe('KEEP');
    expect(writeFile.mock.calls.map((c) => c[0])).toEqual(['C:\\d\\a (3).txt']);
    expect(tree.value.map((n) => n.id)).toEqual([orig, copy]);
  });
});

describe('copy and paste', () => {
  it('pastes a copy at the end of another file group', async () => {
    commitTree([group('G1'), group('G2')]);
    const a = newNote({ text: 'x', groupId: 'G1', activate: false });
    const keep = newNote({ text: 'y', groupId: 'G2', activate: false });
    copyDoc(a);
    const copy = (await pasteInto('G2'))!;
    expect(childIds('G1')).toEqual([a]);
    expect(childIds('G2')).toEqual([keep, copy]);
  });
  it('pastes into Ungrouped above the file groups', async () => {
    commitTree([group('G1')]);
    const a = newNote({ text: 'x', groupId: 'G1', activate: false });
    copyDoc(a);
    const copy = (await pasteInto(null))!;
    expect(tree.value.map((n) => n.id)).toEqual([copy, 'G1']);
  });
  it('paste does nothing when nothing was copied', async () => {
    expect(await pasteInto(null)).toBeNull();
  });
});
