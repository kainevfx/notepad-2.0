import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: string[] = [];
let kind: 'file' | 'dir' | 'missing' = 'file';
vi.mock('../platform', () => ({
  platform: {
    pathKind: async (p: string) => (calls.push(`kind ${p}`), kind),
    openFolder: async (p: string) => void calls.push(`folder ${p}`),
    openExternal: async (u: string) => void calls.push(`web ${u}`),
  },
}));
vi.mock('./app', () => ({ openFiles: async (ps: string[]) => (calls.push(`open ${ps[0]}`), null) }));
vi.mock('./ui', async (orig) => ({ ...(await orig<typeof import('./ui')>()), alertMsg: async (_t: string, m: string) => void calls.push(`alert ${m}`) }));

import { followLink } from './links';
import { toast } from './ui';

const doc = 'C:\\P\\plan.md';
beforeEach(() => {
  calls.length = 0;
  toast.value = null;
});

describe('followLink', () => {
  it('a folder opens File Explorer', async () => {
    kind = 'dir';
    await followLink('Art%20Refs/', doc);
    expect(calls).toEqual(['kind C:\\P\\Art Refs', 'folder C:\\P\\Art Refs']);
  });
  it('a file opens in a tab', async () => {
    kind = 'file';
    await followLink('ledger.csv', doc);
    expect(calls).toEqual(['kind C:\\P\\ledger.csv', 'open C:\\P\\ledger.csv']);
  });
  it('a missing target says so', async () => {
    kind = 'missing';
    await followLink('gone.md', doc);
    expect(calls).toEqual(['kind C:\\P\\gone.md', "alert Couldn't find C:\\P\\gone.md"]);
  });
  it('web links go to the browser', async () => {
    await followLink('https://x.com', doc);
    expect(calls).toEqual(['web https://x.com']);
  });
  it('relative links in an unsaved note ask for a save first', async () => {
    await followLink('a.md', null);
    expect(calls).toEqual([]);
    expect(toast.value).toBe('Save this note first so relative links have a folder to start from.');
  });
  it('anchors scroll', async () => {
    const seen: string[] = [];
    await followLink('#Top%20part', doc, (id) => seen.push(id));
    expect(seen).toEqual(['Top part']);
  });
});
