import { describe, it, expect, vi, beforeEach } from 'vitest';

const renameFile = vi.fn(async (_from: string, _to: string) => {});
vi.mock('../platform', () => ({
  platform: new Proxy({} as Record<string, unknown>, { get: (_t, k) => (k === 'renameFile' ? renameFile : async () => null) }),
  isTauri: false,
}));
import { docs, tree, renameDoc, renameGroupTo, newNote, displayTitle, type DocMeta } from './app';

function fileDoc(id: string, path: string): DocMeta {
  const d = {
    id, kind: 'file', path, title: path.split('\\').pop()!, encoding: 'utf-8', bom: false, eol: 'crlf', language: 'plain',
    mdView: 'edit', dirty: false, mtime: 1, readonly: false, created: 1, modified: 1,
  } as DocMeta;
  docs.value = { ...docs.value, [id]: d };
  tree.value = [...tree.value, { id, kind: 'note' }];
  return d;
}

beforeEach(() => {
  renameFile.mockReset();
  renameFile.mockImplementation(async () => {});
  docs.value = {};
  tree.value = [];
});

describe('renameDoc', () => {
  it('renames a saved file on disk, keeping its extension when none is typed', async () => {
    fileDoc('f', 'C:\\d\\a.txt');
    expect(await renameDoc('f', 'b')).toBe(true);
    expect(renameFile).toHaveBeenCalledWith('C:\\d\\a.txt', 'C:\\d\\b.txt');
    expect(docs.value.f.path).toBe('C:\\d\\b.txt');
    expect(displayTitle(docs.value.f)).toBe('b.txt');
  });
  it('uses a typed extension and switches to Markdown for .md', async () => {
    fileDoc('f', 'C:\\d\\a.txt');
    await renameDoc('f', 'notes.md');
    expect(renameFile).toHaveBeenCalledWith('C:\\d\\a.txt', 'C:\\d\\notes.md');
    expect(docs.value.f.language).toBe('markdown');
  });
  it('leaves everything unchanged when the rename fails (name taken)', async () => {
    renameFile.mockRejectedValueOnce(new Error('exists'));
    fileDoc('f', 'C:\\d\\a.txt');
    expect(await renameDoc('f', 'b')).toBe(false);
    expect(docs.value.f.path).toBe('C:\\d\\a.txt');
  });
  it('refuses names Windows cannot use', async () => {
    fileDoc('f', 'C:\\d\\a.txt');
    expect(await renameDoc('f', 'bad:name')).toBe(false);
    expect(renameFile).not.toHaveBeenCalled();
  });
  it('an unsaved note just gets a new title', async () => {
    const id = newNote({ text: 'x', activate: false });
    expect(await renameDoc(id, 'Shopping')).toBe(true);
    expect(displayTitle(docs.value[id])).toBe('Shopping');
    expect(renameFile).not.toHaveBeenCalled();
  });
});

describe('renameGroupTo', () => {
  it('renames a file group; blank names are ignored', () => {
    tree.value = [{ id: 'G', kind: 'group', name: 'Old', color: 'blue', collapsed: false, children: [] }];
    renameGroupTo('G', '  New name ');
    expect((tree.value[0] as any).name).toBe('New name');
    renameGroupTo('G', '   ');
    expect((tree.value[0] as any).name).toBe('New name');
  });
});
