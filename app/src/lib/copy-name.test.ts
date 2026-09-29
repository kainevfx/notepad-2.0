import { describe, it, expect } from 'vitest';
import { copyName } from './copy-name';

const none = () => false;
describe('copyName', () => {
  it('adds (2) before the extension', () => expect(copyName('Notes.md', none)).toBe('Notes (2).md'));
  it('skips numbers already taken', () => expect(copyName('Notes.md', (n) => n === 'Notes (2).md')).toBe('Notes (3).md'));
  it('counts on from an existing copy', () => expect(copyName('Notes (2).md', none)).toBe('Notes (3).md'));
  it('works without an extension', () => expect(copyName('Notes', none)).toBe('Notes (2)'));
  it('is case-insensitive about taken names', () => expect(copyName('a.txt', (n) => n.toLowerCase() === 'a (2).txt')).toBe('a (3).txt'));
  it('a dot-file keeps its whole name as the stem', () => expect(copyName('.env', none)).toBe('.env (2)'));
});
