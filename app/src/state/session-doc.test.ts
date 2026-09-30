import { describe, it, expect, vi } from 'vitest';
vi.mock('../platform', () => ({ platform: new Proxy({}, { get: () => async () => null }), isTauri: false }));
import { sessionDoc } from './app';

describe('sessionDoc', () => {
  it('binary tabs keep only path and view state', () => {
    const d: any = {
      id: 'f1', kind: 'file', path: 'C:\\a.xlsx', title: 'a.xlsx', viewer: 'sheet', dirty: true, banner: { kind: 'error', text: 'x' },
      encoding: 'utf-8', bom: false, eol: 'crlf', language: 'plain', mdView: 'visual', mtime: 5, readonly: true, created: 1, modified: 2,
    };
    const s = sessionDoc(d);
    expect(s.dirty).toBe(false);
    expect(s.banner).toBe(null);
    expect(s.viewer).toBe('sheet');
    expect(s.path).toBe('C:\\a.xlsx');
  });
  it('keeps the restored banner for text files, drops others', () => {
    expect(sessionDoc({ id: 'f2', kind: 'file', path: 'C:\\a.txt', banner: { kind: 'restored', text: 'r' }, dirty: true } as any).banner).toEqual({ kind: 'restored', text: 'r' });
    expect(sessionDoc({ id: 'f3', kind: 'file', path: 'C:\\a.txt', banner: { kind: 'external', text: 'e' }, dirty: true } as any).banner).toBe(null);
  });
});
