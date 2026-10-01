import { describe, it, expect, vi, beforeEach } from 'vitest';

// A tiny in-memory disk; every other platform call is a harmless async no-op.
const disk = new Map<string, string>();
const emitted: { ev: string; p: any }[] = [];
const impl: Record<string, (...a: any[]) => any> = {
  documentsDir: async () => 'C:\\Users\\K\\Documents',
  stat: async (p: string) => ({ exists: disk.has(p), mtime: 1, size: disk.get(p)?.length ?? 0, readonly: false }),
  writeFile: async (p: string, b: Uint8Array) => {
    disk.set(p, new TextDecoder().decode(b));
    return 1;
  },
  renameFile: async (a: string, b: string) => {
    if (disk.has(b)) throw new Error('exists');
    disk.set(b, disk.get(a)!);
    disk.delete(a);
  },
  deleteIfEmpty: async (p: string) => {
    if (disk.get(p) === '') disk.delete(p);
  },
  emit: async (ev: string, p: any) => void emitted.push({ ev, p }),
};
vi.mock('../platform', () => ({ platform: new Proxy({}, { get: (_t, k: string) => impl[k] ?? (async () => null) }), isTauri: false }));

import { newNote, closeDoc, docs, fileStem, saveFolderPath, saveState, flushAll, fileLocations } from './app';
import { settings } from './settings';
import { nextSelection } from './selection';
import { dayTime, shortWhen, typeLabel } from '../lib/when';

const DIR = 'C:\\Users\\K\\Documents\\Notepad 2.0';

beforeEach(() => {
  disk.clear();
  emitted.length = 0;
  settings.value = { ...settings.value, saveFolder: '', deleteEmptyNotesOnClose: true };
});

describe('the default save folder', () => {
  it('is Documents\\Notepad 2.0 unless Settings picks another', async () => {
    expect(await saveFolderPath()).toBe(DIR);
    settings.value = { ...settings.value, saveFolder: 'E:\\Notes\\' };
    expect(await saveFolderPath()).toBe('E:\\Notes');
  });

  it('a note is written there as a file named after its first line, and turns green', async () => {
    const id = newNote({ text: 'Shopping list\nmilk', activate: false, language: 'markdown' });
    await flushAll();
    await new Promise((r) => setTimeout(r, 0));
    const d = docs.value[id];
    expect(d.savedPath).toBe(`${DIR}\\Shopping list.md`);
    expect(disk.get(d.savedPath!)).toBe('Shopping list\r\nmilk');
    expect(saveState(d).saved).toBe(true);
    expect(emitted.some((e) => e.ev === 'note-saved' && e.p.id === id)).toBe(true);
    expect(fileLocations()).toContainEqual({ folder: DIR, count: expect.any(Number) });
  });

  it('never overwrites another file with the same name', async () => {
    disk.set(`${DIR}\\Plan.txt`, 'someone else');
    const id = newNote({ text: 'Plan', activate: false, language: 'plain' });
    await flushAll();
    await new Promise((r) => setTimeout(r, 0));
    expect(docs.value[id].savedPath).toBe(`${DIR}\\Plan (2).txt`);
    expect(disk.get(`${DIR}\\Plan.txt`)).toBe('someone else');
  });

  it('closing a note that still has text keeps its file', async () => {
    const id = newNote({ text: 'Temp', activate: false, language: 'plain' });
    await flushAll();
    await new Promise((r) => setTimeout(r, 0));
    const p = docs.value[id].savedPath!;
    expect(disk.has(p)).toBe(true);
    await closeDoc(id, { skipPrompt: true });
    expect(disk.has(p)).toBe(true);
  });
});

describe('file names from titles', () => {
  it('drops characters Windows refuses and trims to 60', () => {
    expect(fileStem('a/b:c*d?')).toBe('a b c d');
    expect(fileStem('   ')).toBe('Untitled');
    expect(fileStem('con')).toBe('_con');
    expect(fileStem('x'.repeat(80)).length).toBe(60);
    expect(fileStem('ends with dots...')).toBe('ends with dots');
  });
});

describe('sidebar multi-select', () => {
  const order = ['a', 'b', 'c', 'd', 'e'];
  it('a plain click selects one', () => {
    expect(nextSelection(['a', 'c'], 'b', { ctrl: false, shift: false }, order, 'a')).toEqual({ sel: ['b'], anchor: 'b' });
  });
  it('Ctrl+click adds and removes', () => {
    expect(nextSelection(['a'], 'c', { ctrl: true, shift: false }, order, 'a').sel).toEqual(['a', 'c']);
    expect(nextSelection(['a', 'c'], 'a', { ctrl: true, shift: false }, order, 'a').sel).toEqual(['c']);
  });
  it('Shift+click selects the run between the anchor and the click, either direction', () => {
    expect(nextSelection(['b'], 'd', { ctrl: false, shift: true }, order, 'b').sel).toEqual(['b', 'c', 'd']);
    expect(nextSelection(['d'], 'a', { ctrl: false, shift: true }, order, 'd').sel).toEqual(['a', 'b', 'c', 'd']);
  });
  it('Ctrl+Shift adds a run to what is selected', () => {
    expect(nextSelection(['e'], 'c', { ctrl: true, shift: true }, order, 'a').sel).toEqual(['e', 'a', 'b', 'c']);
  });
});

describe('small print', () => {
  const now = new Date(2026, 9, 1, 19, 40).getTime();
  it('says today / yesterday / a date', () => {
    expect(dayTime(new Date(2026, 9, 1, 19, 38).getTime(), now)).toBe('today 19:38');
    expect(dayTime(new Date(2026, 8, 30, 22, 9).getTime(), now)).toBe('yesterday 22:09');
    expect(shortWhen(new Date(2026, 9, 1, 9, 5).getTime(), now)).toBe('09:05');
    expect(shortWhen(new Date(2026, 8, 30, 22, 9).getTime(), now)).toBe('yesterday');
    expect(dayTime(new Date(2025, 8, 28).getTime(), now)).toBe('28 Sep 2025');
  });
  it('names the file type from the path, else the language', () => {
    expect(typeLabel({ path: 'C:\\a\\b.xlsx', language: 'plain' })).toBe('.xlsx file');
    expect(typeLabel({ path: null, language: 'markdown' })).toBe('.md file');
    expect(typeLabel({ path: null, language: 'plain' })).toBe('.txt file');
  });
});
