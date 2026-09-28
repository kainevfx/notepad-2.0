// Byte-level text encoding for Notepad 2.0.
// Decoding detects BOM, UTF-16 without BOM, valid UTF-8, then falls back to Windows-1252
// (Notepad's "ANSI"). Encoding writes back exactly the same encoding, BOM and line ending,
// so opening then saving an untouched file is byte-identical (except mixed line endings,
// which normalise to the dominant style once you edit and save).

export type Encoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';
export type Eol = 'crlf' | 'lf' | 'cr';

export interface DecodedText {
  text: string; // always '\n' line separators
  encoding: Encoding;
  bom: boolean;
  eol: Eol;
  mixedEol: boolean;
}

export const ENCODING_LABEL: Record<Encoding, string> = {
  'utf-8': 'UTF-8',
  'utf-16le': 'UTF-16 LE',
  'utf-16be': 'UTF-16 BE',
  'windows-1252': 'ANSI',
};

export const EOL_LABEL: Record<Eol, string> = {
  crlf: 'Windows (CRLF)',
  lf: 'Unix (LF)',
  cr: 'Macintosh (CR)',
};

export const EOL_CHARS: Record<Eol, string> = { crlf: '\r\n', lf: '\n', cr: '\r' };

// Windows-1252 bytes 0x80..0x9F. Undefined slots (0x81, 0x8D, 0x8F, 0x90, 0x9D) map to the
// C1 control of the same value, which is what Windows itself does (best-fit round trip).
const CP1252_HIGH = [
  0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178,
];
const CP1252_REVERSE = new Map<number, number>();
CP1252_HIGH.forEach((cp, i) => CP1252_REVERSE.set(cp, 0x80 + i));

function decode1252(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    const codes = new Array<number>(slice.length);
    for (let j = 0; j < slice.length; j++) {
      const b = slice[j];
      codes[j] = b >= 0x80 && b <= 0x9f ? CP1252_HIGH[b - 0x80] : b;
    }
    out += String.fromCharCode(...codes);
  }
  return out;
}

function encode1252(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  let n = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80 || (cp >= 0xa0 && cp <= 0xff)) out[n++] = cp;
    else out[n++] = CP1252_REVERSE.get(cp) ?? 0x3f; // '?' like Notepad's ANSI save
  }
  return out.subarray(0, n);
}

/** True when every character survives a Windows-1252 save. */
export function fitsAnsi(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (!(cp < 0x80 || (cp >= 0xa0 && cp <= 0xff) || CP1252_REVERSE.has(cp))) return false;
  }
  return true;
}

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/** Heuristic for BOM-less UTF-16: lots of zero bytes in one parity. */
function sniffUtf16(bytes: Uint8Array): Encoding | null {
  if (bytes.length < 4 || bytes.length % 2) return null;
  const n = Math.min(bytes.length, 4096);
  let evenZero = 0;
  let oddZero = 0;
  for (let i = 0; i < n; i += 2) {
    if (bytes[i] === 0) evenZero++;
    if (bytes[i + 1] === 0) oddZero++;
  }
  const pairs = n / 2;
  if (oddZero > pairs * 0.4 && evenZero < pairs * 0.05) return 'utf-16le';
  if (evenZero > pairs * 0.4 && oddZero < pairs * 0.05) return 'utf-16be';
  return null;
}

export function detectEol(raw: string): { eol: Eol; mixed: boolean } {
  let crlf = 0;
  let lf = 0;
  let cr = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c === 13) {
      if (raw.charCodeAt(i + 1) === 10) {
        crlf++;
        i++;
      } else cr++;
    } else if (c === 10) lf++;
  }
  const kinds = [crlf, lf, cr].filter((x) => x > 0).length;
  // New files and single-line files default to CRLF, like Notepad.
  let eol: Eol = 'crlf';
  if (lf > crlf && lf >= cr) eol = 'lf';
  else if (cr > crlf && cr > lf) eol = 'cr';
  return { eol, mixed: kinds > 1 };
}

export function normaliseEol(raw: string): string {
  return raw.replace(/\r\n?/g, '\n');
}

export function decodeBytes(bytes: Uint8Array): DecodedText {
  let encoding: Encoding;
  let bom = false;
  let body = bytes;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    encoding = 'utf-8';
    bom = true;
    body = bytes.subarray(3);
  } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = 'utf-16le';
    bom = true;
    body = bytes.subarray(2);
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = 'utf-16be';
    bom = true;
    body = bytes.subarray(2);
  } else {
    encoding = sniffUtf16(bytes) ?? (isValidUtf8(bytes) ? 'utf-8' : 'windows-1252');
  }
  const raw =
    encoding === 'windows-1252' ? decode1252(body) : new TextDecoder(encoding, { ignoreBOM: true }).decode(body);
  const { eol, mixed } = detectEol(raw);
  return { text: normaliseEol(raw), encoding, bom, eol, mixedEol: mixed };
}

export function encodeText(text: string, encoding: Encoding, bom: boolean, eol: Eol): Uint8Array {
  const raw = eol === 'lf' ? text : text.replace(/\n/g, EOL_CHARS[eol]);
  let body: Uint8Array;
  let prefix: number[] = [];
  switch (encoding) {
    case 'utf-8':
      body = new TextEncoder().encode(raw);
      if (bom) prefix = [0xef, 0xbb, 0xbf];
      break;
    case 'utf-16le':
    case 'utf-16be': {
      const le = encoding === 'utf-16le';
      body = new Uint8Array(raw.length * 2);
      for (let i = 0; i < raw.length; i++) {
        const u = raw.charCodeAt(i);
        body[i * 2] = le ? u & 0xff : u >> 8;
        body[i * 2 + 1] = le ? u >> 8 : u & 0xff;
      }
      if (bom) prefix = le ? [0xff, 0xfe] : [0xfe, 0xff];
      break;
    }
    case 'windows-1252':
      body = encode1252(raw);
      break;
  }
  if (!prefix.length) return body;
  const out = new Uint8Array(prefix.length + body.length);
  out.set(prefix, 0);
  out.set(body, prefix.length);
  return out;
}

export function encodingLabel(e: Encoding, bom: boolean): string {
  if (e === 'utf-8' && bom) return 'UTF-8 with BOM';
  return ENCODING_LABEL[e];
}
