import { describe, it, expect } from 'vitest';
import { noteTitle } from './note-title';

describe('noteTitle', () => {
  it('uses the words, not the colour markup', () => expect(noteTitle('<span style="color:#d93025">My Title</span>\nbody')).toBe('My Title'));
  it('drops heading marks and emphasis', () => expect(noteTitle('# **Bold** head')).toBe('Bold head'));
  it('keeps link text only', () => expect(noteTitle('[link](https://x) text')).toBe('link text'));
  it('decodes entities', () => expect(noteTitle('Tom &amp; Jerry')).toBe('Tom & Jerry'));
  it('skips lines that are only markup (an aligned div)', () => expect(noteTitle('<div align="center">\n\n## Centred\n\n</div>')).toBe('Centred'));
  it('skips front matter', () => expect(noteTitle('---\ntitle: x\n---\n\nReal first line')).toBe('Real first line'));
  it('underline and list markers', () => expect(noteTitle('- <u>Item</u> one')).toBe('Item one'));
  it('plain text is unchanged', () => expect(noteTitle('hello my name is kaine')).toBe('hello my name is kaine'));
  it('empty is Untitled', () => expect(noteTitle('  \n\n')).toBe('Untitled'));
});
