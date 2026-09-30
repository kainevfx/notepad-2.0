// An HTML file rendered in a sandboxed frame: its own CSS applies, scripts, forms and pop-ups
// never run. Links inside it are followed like any other link (folders open in File Explorer).
import { useMemo, useRef } from 'preact/hooks';
import type { ViewerProps } from '../ViewerPane';
import { prepareHtml, assetDirBase } from '../../lib/html-doc';
import { settings } from '../../state/settings';
import { dirname } from '../../state/app';
import { followLink } from '../../state/links';
import { platform } from '../../platform';

export function HtmlViewer({ doc, text }: ViewerProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const block = settings.value.blockRemoteImages;
  const html = useMemo(
    () => prepareHtml(text, doc.path ? assetDirBase(dirname(doc.path), platform.assetUrl) : null, block),
    [text, doc.path, block],
  );

  const onLoad = () => {
    const d = frame.current?.contentDocument;
    if (!d) return;
    d.addEventListener('click', (e) => {
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!a) return;
      e.preventDefault();
      const href = a.getAttribute('href') ?? '';
      void followLink(href, doc.path, (id) => (d.getElementById(id) ?? d.getElementsByName(id)[0])?.scrollIntoView({ block: 'start' }));
    });
  };

  // allow-same-origin only lets this window reach into the frame to catch link clicks; without
  // allow-scripts nothing in the page can run.
  return <iframe ref={frame} class="html-frame" sandbox="allow-same-origin" srcDoc={html} title={doc.title} onLoad={onLoad} />;
}
