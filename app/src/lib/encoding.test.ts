import { describe, expect, it } from 'vitest';
import { decodeBytes, encodeText, detectEol, fitsAnsi } from './encoding';

const roundTrip = (bytes: Uint8Array) => {
  const d = decodeBytes(bytes);
  return encodeText(d.text, d.encoding, d.bom, d.eol);
};
const u8 = (...parts: (number[] | Uint8Array)[]) => {
  const all: number[] = [];
  for (const p of parts) all.push(...p);
  return new Uint8Array(all);
};
const utf8 = (s: string) => new TextEncoder().encode(s);
const utf16 = (s: string, le: boolean) => {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    le ? out.push(c & 0xff, c >> 8) : out.push(c >> 8, c & 0xff);
  }
  return out;
};

describe('encoding round trip is byte-identical', () => {
  const text = 'Hello £ € “quotes” — naïve 日本語 🎛️\r\nline two\r\n';
  const cases: [string, Uint8Array, string][] = [
    ['utf-8 crlf', utf8(text), 'utf-8'],
    ['utf-8 lf', utf8(text.replace(/\r\n/g, '\n')), 'utf-8'],
    ['utf-8 cr', utf8(text.replace(/\r\n/g, '\r')), 'utf-8'],
    ['utf-8 bom', u8([0xef, 0xbb, 0xbf], utf8(text)), 'utf-8'],
    ['utf-16 le bom', u8([0xff, 0xfe], utf16(text, true)), 'utf-16le'],
    ['utf-16 be bom', u8([0xfe, 0xff], utf16(text, false)), 'utf-16be'],
    ['utf-16 le no bom', u8(utf16('plain ascii text here\r\n', true)), 'utf-16le'],
    ['windows-1252', u8([0x43, 0x61, 0x66, 0xe9, 0x20, 0x80, 0x20, 0x93, 0x71, 0x94, 0x0d, 0x0a]), 'windows-1252'],
    ['empty', new Uint8Array(), 'utf-8'],
    ['no trailing newline', utf8('one line'), 'utf-8'],
  ];
  for (const [name, bytes, enc] of cases) {
    it(name, () => {
      expect(decodeBytes(bytes).encoding).toBe(enc);
      expect(Array.from(roundTrip(bytes))).toEqual(Array.from(bytes));
    });
  }
});

describe('decoding', () => {
  it('normalises line endings to \\n for the editor', () => {
    const d = decodeBytes(utf8('a\r\nb\r\nc'));
    expect(d.text).toBe('a\nb\nc');
    expect(d.eol).toBe('crlf');
  });
  it('decodes windows-1252 smart quotes and euro', () => {
    expect(decodeBytes(u8([0x80, 0x93, 0x94])).text).toBe('€“”');
  });
  it('flags mixed line endings and picks the dominant one', () => {
    const r = detectEol('a\nb\nc\r\nd');
    expect(r).toEqual({ eol: 'lf', mixed: true });
  });
  it('defaults to CRLF like Notepad', () => {
    expect(detectEol('single').eol).toBe('crlf');
  });
  it('knows what fits in ANSI', () => {
    expect(fitsAnsi('Café €')).toBe(true);
    expect(fitsAnsi('日本')).toBe(false);
  });
});
