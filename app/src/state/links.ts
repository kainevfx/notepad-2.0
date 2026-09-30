// Following a clicked link: headings scroll, web links open in the browser, folders open in
// File Explorer, files open in a tab (through the file viewers).
import { resolveLinkTarget } from '../lib/link-target';
import { platform } from '../platform';
import { openFiles } from './app';
import { alertMsg, showToast } from './ui';

export async function followLink(href: string, docPath: string | null, scrollTo?: (id: string) => void): Promise<void> {
  const t = resolveLinkTarget(href, docPath);
  if (t.kind === 'anchor') return scrollTo?.(t.id);
  if (t.kind === 'web') return platform.openExternal(t.url);
  if (t.kind === 'needs-save') return showToast('Save this note first so relative links have a folder to start from.');
  if (t.kind !== 'path') return;
  const kind = await platform.pathKind(t.path).catch(() => 'missing' as const);
  if (kind === 'dir') return platform.openFolder(t.path).catch((e) => alertMsg('Notepad 2.0', String(e)));
  if (kind === 'file') {
    await openFiles([t.path]);
    return;
  }
  await alertMsg('Notepad 2.0', `Couldn't find ${t.path}`);
}
