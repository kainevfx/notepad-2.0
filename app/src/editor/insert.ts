// Text the Insert menu puts into a document (pure helpers; the menu wires them to the editors).

export type SnippetKind = 'pageBreak' | 'lineBreak';

/** Page break: prints as a new page. Line break: a break inside the same paragraph. */
export function insertSnippet(kind: SnippetKind, markdown: boolean): string {
  if (kind === 'pageBreak') return markdown ? '\n\n<div class="page-break"></div>\n\n' : '\f';
  return markdown ? '<br>\n' : '\n';
}

/** A Windows drive path like C:\x or C:/x. */
export function isAbsolutePath(p: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(p);
}

const parts = (p: string) => p.replace(/\\/g, '/').split('/').filter(Boolean);
const encode = (p: string) => p.split('/').map(encodeURIComponent).join('/').replace(/%3A/i, ':');

/**
 * Markdown for an image: relative to the document's folder when both are on the same drive,
 * otherwise (or for unsaved notes) the absolute path with forward slashes.
 */
export function imageMarkdown(docPath: string | null, imagePath: string): string {
  const file = parts(imagePath);
  const name = file[file.length - 1] ?? 'image';
  const alt = name.replace(/\.[^.]+$/, '');
  if (docPath) {
    const dir = parts(docPath).slice(0, -1);
    if (dir[0]?.toLowerCase() === file[0]?.toLowerCase()) {
      let common = 0;
      while (common < dir.length && common < file.length - 1 && dir[common].toLowerCase() === file[common].toLowerCase()) common++;
      const rel = [...Array(dir.length - common).fill('..'), ...file.slice(common)].join('/');
      return `![${alt}](${encode(rel)})`;
    }
  }
  return `![${alt}](${encode(file.join('/'))})`;
}
