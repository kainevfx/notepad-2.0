const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', hellip: '…', mdash: '—', ndash: '–' };

function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** One line of Markdown/HTML as the plain words a reader sees. */
function plainLine(raw: string): string {
  return decodeEntities(
    raw
      .replace(/<[^>]*>/g, '') // HTML tags (colour spans, <u>, aligned divs…)
      .replace(/^\s*(#{1,6}\s+|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+|>\s*)/, '') // heading / list / quote markers
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links and images -> their text
      .replace(/[*_`~]/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tab title / suggested file name for an untitled note: its first line of real words. */
export function noteTitle(text: string): string {
  const lines = text.split('\n', 60);
  let i = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) i = end + 1; // skip front matter
  }
  for (; i < lines.length; i++) {
    const line = plainLine(lines[i]);
    if (line) return line.length > 40 ? line.slice(0, 40).trimEnd() + '…' : line;
  }
  return 'Untitled';
}
