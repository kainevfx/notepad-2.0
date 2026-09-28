import { describe, expect, it } from 'vitest';
import { parseLaunchArgs } from './notepad-args';

const EXE = 'C:\\Program Files\\Notepad 2.0\\notepad2.exe';

describe('parseLaunchArgs', () => {
  it('no file', () => {
    expect(parseLaunchArgs([EXE]).files).toEqual([]);
  });
  it('plain file and relative path', () => {
    expect(parseLaunchArgs([EXE, 'C:\\a.txt']).files).toEqual(['C:\\a.txt']);
    expect(parseLaunchArgs([EXE, 'notes.md'], 'D:\\work').files).toEqual(['D:\\work\\notes.md']);
  });
  it('several files and flags', () => {
    const r = parseLaunchArgs([EXE, '--hidden', 'C:\\a.txt', 'C:\\b.md']);
    expect(r.hidden).toBe(true);
    expect(r.files).toEqual(['C:\\a.txt', 'C:\\b.md']);
  });
  it('quick note flag', () => {
    expect(parseLaunchArgs([EXE, '--quicknote']).quickNote).toBe(true);
  });
  it('IFEO: drops the notepad path', () => {
    const r = parseLaunchArgs([EXE, '--notepad-style-cmdline', 'C:\\Windows\\System32\\notepad.exe', 'C:\\x.txt']);
    expect(r.viaNotepad).toBe(true);
    expect(r.files).toEqual(['C:\\x.txt']);
  });
  it('IFEO: unquoted path with spaces becomes one file', () => {
    const r = parseLaunchArgs([EXE, '--notepad-style-cmdline', 'notepad', 'C:\\My', 'Docs\\to', 'do.txt']);
    expect(r.files).toEqual(['C:\\My Docs\\to do.txt']);
  });
  it('IFEO: quoted notepad path and quoted file', () => {
    const r = parseLaunchArgs([EXE, '--notepad-style-cmdline', '"C:\\Windows\\notepad.exe"', '"C:\\a b.txt"']);
    expect(r.files).toEqual(['C:\\a b.txt']);
  });
  it('IFEO: /P prints, /A and /W are ignored', () => {
    const r = parseLaunchArgs([EXE, '--notepad-style-cmdline', 'C:\\Windows\\system32\\NOTEPAD.EXE', '/A', '/P', 'C:\\x.txt']);
    expect(r.print).toBe(true);
    expect(r.files).toEqual(['C:\\x.txt']);
  });
  it('IFEO: no file opens an empty tab', () => {
    const r = parseLaunchArgs([EXE, '--notepad-style-cmdline', 'C:\\Windows\\System32\\notepad.exe']);
    expect(r.files).toEqual([]);
  });
  it('IFEO: relative file resolves against cwd', () => {
    const r = parseLaunchArgs([EXE, '--notepad-style-cmdline', 'notepad.exe', 'readme.txt'], 'C:\\proj');
    expect(r.files).toEqual(['C:\\proj\\readme.txt']);
  });
});
