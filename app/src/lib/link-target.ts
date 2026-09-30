// Where a link in a document points: a heading, a web page, or a local path (file or folder).
// Pure, so the rules are unit-tested; state/links.ts decides what to do with a path.

export type LinkTarget =
  | { kind: 'anchor'; id: string }
  | { kind: 'web'; url: string }
  | { kind: 'path'; path: string }
  | { kind: 'needs-save' }
  | { kind: 'none' };

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Backslashes, no "." / ".." / empty segments, never above the drive or share. */
function normalize(p: string): string {
  const unc = /^(\\\\|\/\/)/.test(p);
  const parts = p.replace(/\//g, '\\').split('\\');
  const out: string[] = [];
  parts.forEach((part, i) => {
    if (part === '..') {
      if (out.length > (unc ? 4 : 1)) out.pop();
    } else if (part === '.' || (part === '' && !(unc && i < 2))) {
      // skip
    } else out.push(part);
  });
  return out.join('\\');
}

const dirOf = (p: string) => p.slice(0, Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/')));

export function resolveLinkTarget(href: string, docPath: string | null): LinkTarget {
  const h = href.trim();
  if (!h) return { kind: 'none' };
  if (h.startsWith('#')) return { kind: 'anchor', id: safeDecode(h.slice(1)) };
  if (/^(https?:|mailto:)/i.test(h)) return { kind: 'web', url: h };
  const noFrag = h.replace(/#.*$/, '');
  if (/^file:/i.test(noFrag)) return { kind: 'path', path: normalize(safeDecode(noFrag.replace(/^file:\/*/i, ''))) };
  const dec = safeDecode(noFrag);
  if (/^[a-zA-Z]:[\\/]/.test(dec) || /^(\\\\|\/\/)/.test(dec)) return { kind: 'path', path: normalize(dec) };
  if (!docPath) return { kind: 'needs-save' };
  return { kind: 'path', path: normalize(dirOf(docPath) + '\\' + dec) };
}

const enc = (seg: string) => encodeURIComponent(seg);

/** The href to write for `target` from a document at `docPath`: relative when on the same drive. */
export function relativeLink(target: string, docPath: string | null, isFolder = false): string {
  const t = normalize(target);
  const tail = isFolder ? '/' : '';
  const fileUrl = () => 'file:///' + t.split('\\').map((s, i) => (i === 0 && /^[A-Za-z]:$/.test(s) ? s : enc(s))).join('/') + tail;
  if (!docPath) return fileUrl();
  const from = normalize(dirOf(docPath)).split('\\');
  const to = t.split('\\');
  if (from[0].toLowerCase() !== to[0].toLowerCase()) return fileUrl();
  let i = 0;
  while (i < from.length && i < to.length && from[i].toLowerCase() === to[i].toLowerCase()) i++;
  return [...from.slice(i).map(() => '..'), ...to.slice(i).map(enc)].join('/') + tail;
}
