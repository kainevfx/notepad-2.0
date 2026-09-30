import { renderMarkdown } from '../markdown/pipeline';

/** Use detached DOM: no images are downloaded and no source HTML is executed. */
export function readableText(source: string, markdown: boolean): string {
  if (!markdown) return source.trim();
  const doc = new DOMParser().parseFromString(renderMarkdown(source, { blockRemoteImages: true }), 'text/html');
  doc.querySelectorAll('pre, script, style, input, [data-footnote-backref], .katex-html').forEach(el => el.remove());
  doc.querySelectorAll('img').forEach(el => el.replaceWith(el.getAttribute('alt')?.replace(/^\[remote image blocked\]\s*/, '') ?? ''));
  doc.querySelectorAll('br, hr').forEach(el => el.replaceWith('\n'));
  doc.querySelectorAll('th, td').forEach(el => el.append('. '));
  doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, tr, blockquote, div, section, summary, figcaption').forEach(el => el.append('\n\n'));
  return (doc.body.textContent ?? '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Bound every request, preserving all text and preferring paragraph/sentence boundaries. */
export function speechChunks(text: string, max = 800): string[] {
  if (max < 16) throw new Error('Speech chunk limit must be at least 16.');
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const head = rest.slice(0, max);
    const boundaries = [...head.matchAll(/\n\n|[.!?][”"'’)]*\s+/g)];
    const last = boundaries.at(-1);
    let cut = last && last.index! > max / 3 ? last.index! + last[0].length : head.lastIndexOf(' ');
    if (cut < max / 3) cut = max;
    // Never split a UTF-16 surrogate pair.
    if (/[\uD800-\uDBFF]/.test(rest[cut - 1])) cut--;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
