// Word documents (.docx) converted to formatted text with mammoth: headings, lists, tables,
// links and embedded images. Read-only; the layout is approximate, so a banner says so.
import { useEffect, useState } from 'preact/hooks';
import type { ViewerProps } from '../ViewerPane';
import { platform } from '../../platform';
import { sanitizeHtml } from '../../markdown/pipeline';
import { followLink } from '../../state/links';
import { Notice } from './Notice';

export function DocxViewer({ doc }: ViewerProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doc.path) return;
    let live = true;
    setError(null);
    (async () => {
      const { bytes } = await platform.readFile(doc.path!);
      const mammoth = await import('mammoth');
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const r = await mammoth.convertToHtml({ arrayBuffer: buf });
      if (live) setHtml(sanitizeHtml(r.value));
    })().catch((e) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, [doc.path, doc.rev]);

  if (error) return <Notice text="Couldn't read this Word document." detail={error} path={doc.path} />;
  if (html === null) return <div class="viewer-loading">Reading document…</div>;

  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a[href]');
    if (!a) return;
    e.preventDefault();
    void followLink(a.getAttribute('href') ?? '', doc.path);
  };
  return (
    <>
      <div class="banner banner-readonly docx-banner">
        <span>Shown as formatted text: the Word layout is approximate.</span>
        <div class="banner-actions">
          <button class="btn" onClick={() => doc.path && platform.openDefault(doc.path).catch(() => {})}>
            Open in Word
          </button>
        </div>
      </div>
      <div class="md-preview">
        <div class="markdown-body docx-body" onClick={(e) => onClick(e as MouseEvent)} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </>
  );
}
