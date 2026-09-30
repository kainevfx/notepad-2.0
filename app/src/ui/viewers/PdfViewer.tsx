// PDFs in the web view's built-in viewer (Edge: scroll, zoom, find, print).
import type { ViewerProps } from '../ViewerPane';
import { platform } from '../../platform';
import { Notice } from './Notice';

export function PdfViewer({ doc }: ViewerProps) {
  if (!doc.path) return null;
  if (platform.kind === 'browser') return <Notice text="PDF preview needs the desktop app." path={null} />;
  return <iframe class="pdf-frame" src={`${platform.assetUrl(doc.path)}?v=${doc.rev ?? 0}#view=FitH`} title={doc.title} />;
}
