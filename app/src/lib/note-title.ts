/** Tab title for an untitled note: its first meaningful line, Markdown markers stripped. */
export function noteTitle(text: string): string {
  for (const raw of text.split('\n', 20)) {
    const line = raw.replace(/^\s*(#{1,6}\s+|[-*+]\s+(\[[ xX]\]\s+)?|>\s*)/, '').replace(/[*_`~]/g, '').trim();
    if (line) return line.length > 40 ? line.slice(0, 40).trimEnd() + '…' : line;
  }
  return 'Untitled';
}
