// Several Notepad 2.0 windows. Each window owns its own files and groups; moving items between
// windows is a hand-over through a transfer file in the app store:
//   1. the source saves pending edits and writes transfers/<id>.json (the items + their text)
//   2. it tells the target window (or opens a new window with ?transfer=<id>)
//   3. the target takes the file (deleting it), adds the items and replies "transfer-done"
//   4. only then does the source remove them, so nothing is lost or duplicated.
import { signal, effect } from '@preact/signals';
import { platform } from '../platform';
import { extractItems, importItems } from '../lib/transfer';
import type { TreeNode } from '../lib/tree-ops';
import * as T from '../lib/tree-ops';
import {
  tree, docs, activeId, activate, snapshotDocs, importDocs, removeDocs, orderedIds, newNote, flushAll, scheduleSession, updateWindowTitle, windowCountRef, type DocMeta,
} from './app';
import { showToast } from './ui';

/** How many Notepad 2.0 windows are open (titles show "Window N" when more than one). */
export const windowCount = signal(1);

interface Transfer {
  id: string;
  from: string;
  nodes: TreeNode[];
  docs: { meta: DocMeta; text: string }[];
  /** Screen point (physical pixels) where the items were dropped, or null to add to Ungrouped. */
  drop: { x: number; y: number } | null;
}

const uid = () => 'tr-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function waitFor(id: string, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    let unlisten: (() => void) | null = null;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unlisten?.();
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), ms);
    platform.listen<{ id: string }>('transfer-done', (p) => p.id === id && finish(true)).then((u) => {
      unlisten = u;
      if (done) u();
    });
  });
}

/**
 * Move items (files or file groups) to the window under a screen point, or into a new window
 * there. `target` = 'merge:<label>' merges into a given window at its Ungrouped section.
 */
export async function sendItems(ids: string[], screenX: number, screenY: number, mergeInto?: string): Promise<boolean> {
  const { nodes, docIds, rest } = extractItems(tree.value, ids);
  if (!nodes.length) return false;
  const id = uid();
  const px = Math.round(screenX * window.devicePixelRatio);
  const py = Math.round(screenY * window.devicePixelRatio);
  const target = mergeInto ?? (await platform.windowAt(px, py));
  const payload: Transfer = { id, from: platform.windowLabel, nodes, docs: await snapshotDocs(docIds), drop: mergeInto ? null : { x: px, y: py } };
  await platform.storeWrite(`transfers/${id}.json`, JSON.stringify(payload));
  if (target) {
    await platform.emitTo(target, 'receive-transfer', id);
  } else {
    await platform.openWindow(px, py, id);
  }
  const ok = await waitFor(id, target ? 5000 : 15000);
  if (!ok) {
    // Take the offer back. If the target already took it, it will still reply, so check again.
    await platform.storeDelete(`transfers/${id}.json`).catch(() => {});
    showToast("Couldn't move it to the other window, so it stays here.");
    return false;
  }
  removeDocs(docIds);
  tree.value = rest;
  if (!orderedIds.value.length && !mergeInto) newNote();
  else if (activeId.value && !docs.value[activeId.value]) activate(orderedIds.value[0]);
  scheduleSession();
  return true;
}

/** Where a physical screen point falls in this window: a file group, before a file, or Ungrouped. */
function dropSpot(drop: Transfer['drop']): { groupId: string | null; beforeId?: string | null } {
  if (!drop) return { groupId: null };
  const x = drop.x / window.devicePixelRatio - window.screenX;
  const y = drop.y / window.devicePixelRatio - window.screenY;
  const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-drop-id]') as HTMLElement | null;
  const id = el?.dataset.dropId;
  if (!id || id === '__root__') return { groupId: null };
  if (el!.dataset.dropKind === 'group') return { groupId: id };
  const loc = T.find(tree.value, id);
  return loc?.parent ? { groupId: loc.parent.id, beforeId: id } : { groupId: null };
}

/** Take in items another window sent. */
export async function receiveTransfer(id: string) {
  const raw = await platform.storeRead(`transfers/${id}.json`);
  if (!raw) return;
  await platform.storeDelete(`transfers/${id}.json`); // claim it
  const t: Transfer = JSON.parse(raw);
  const spot = dropSpot(t.drop);
  importDocs(t.docs);
  tree.value = importItems(tree.value, t.nodes, spot);
  const first = t.docs[0]?.meta.id;
  if (first) activate(first);
  scheduleSession();
  await platform.emitTo(t.from, 'transfer-done', { id });
  await platform.show();
}

/** Closing this window while others are open: hand everything to the last-used other window. */
export async function closeIntoOtherWindow(): Promise<boolean> {
  const other = await platform.lastOtherWindow();
  if (!other) return false;
  await flushAll();
  const ids = tree.value.map((n) => n.id);
  if (ids.length && !(await sendItems(ids, 0, 0, other))) return false;
  await platform.storeDelete(`sessions/${platform.windowLabel}.json`).catch(() => {});
  await platform.closeWindow();
  return true;
}

/** Quit: every window saves its unsaved state first. */
export async function flushEveryWindow() {
  const others = Math.max(0, (await platform.windowCount()) - 1);
  if (others) {
    let replies = 0;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 1500);
      platform.listen('app-flushed', () => {
        if (++replies >= others) {
          clearTimeout(timer);
          resolve();
        }
      });
      platform.emit('app-flush');
    });
  }
  await flushAll();
}

/** Wire this window into the multi-window system. */
export async function initWindows() {
  const setCount = (n: number) => {
    windowCount.value = n;
    windowCountRef.value = n;
    updateWindowTitle();
  };
  setCount(await platform.windowCount());
  platform.listen<number>('windows-changed', setCount);
  // Tell the other windows which files this one has open (a file is only open in one window).
  effect(() => {
    const paths = Object.values(docs.value).flatMap((d) => (d.path ? [d.path] : []));
    platform.registerOpenFiles(paths).catch(() => {});
  });
  platform.listen<string>('receive-transfer', (id) => void receiveTransfer(id));
  platform.listen('app-flush', async () => {
    await flushAll();
    await platform.emit('app-flushed');
  });
  const transfer = new URLSearchParams(location.search).get('transfer');
  if (transfer) await receiveTransfer(transfer);
  updateWindowTitle();
}
