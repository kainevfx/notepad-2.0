// An HTML file prepared for the sandboxed viewer frame: a <base> so its relative CSS and images
// load from next to the file, and remote images removed when "Block remote images" is on.
// Scripts never run (the frame has no allow-scripts), so they are left in place.

/**
 * A folder as an asset URL with real slashes, so a page's relative links resolve against it
 * (the platform's assetUrl encodes the whole path as one segment).
 */
export function assetDirBase(dir: string, assetUrl: (path: string) => string): string {
  const prefix = assetUrl('x').replace(/x$/, '');
  const segs = dir.split(/[\\/]+/).filter(Boolean);
  return prefix + segs.map(encodeURIComponent).join('/') + '/';
}

export function prepareHtml(html: string, baseHref: string | null, blockRemote: boolean): string {
  let out = html;
  if (blockRemote) {
    out = out
      .replace(/\b(src|srcset)\s*=\s*"\s*https?:[^"]*"/gi, '$1=""')
      .replace(/\b(src|srcset)\s*=\s*'\s*https?:[^']*'/gi, "$1=''")
      .replace(/url\(\s*['"]?https?:[^)]*\)/gi, 'none');
  }
  if (baseHref && !/<base\s/i.test(out)) {
    const tag = `<base href="${baseHref.replace(/"/g, '&quot;')}">`;
    const head = /<head(\s[^>]*)?>/i.exec(out);
    out = head ? out.slice(0, head.index + head[0].length) + tag + out.slice(head.index + head[0].length) : `<head>${tag}</head>${out}`;
  }
  return out;
}
