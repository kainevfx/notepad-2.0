// Several Notepad 2.0 windows. Each window owns its own files and groups; moving items between
// windows is a hand-over through a transfer file in the app store:
//   1. the source saves pending edits and writes transfers/<id>.json (the items + their text)
//   2. it tells the target window (or opens a new window with ?transfer=<id>)
//   3. the target *claims* the file (an atomic rename: only one window can win), adds the items,
//      saves its session, and only then replies "transfer-done"
//   4. the source removes the items when that reply arrives. If no reply comes in time it tries
//      to claim the file back: winning means the move is cancelled (items stay); losing means the
//      target has it, so the source waits for the reply and treats the items as moved.
// Events meant for one window are sent with emitTo and received with listenHere, so no other
// window reacts to them.
import { signal, effect } from '@preact/signals';
import { platform } from '../platform';
import { extractItems, importItems, sessionKey } from '../lib/transfer';
import type { TreeNode } from '../lib/tree-ops';
import * as T from '../lib/tree-ops';
import {
  tree, docs, activeId, activate, snapshotDocs, importDocs, removeDocs, orderedIds, newNote, flushAll, scheduleSession, updateWindowTitle,
  windowCountRef, windowClosing, saveSessionNow, type DocMeta,
} from './app';
import { showToast } from './ui';

/** How many Notepad 2.0 windows are open (titles show "Window N" when more than one). */
export const windowCount = signal(1);

/** Items currently being handed to another window (they can't be dragged again meanwhile). */
export const inFlight = new Set<string>();

interface Transfer {
  id: string;
  from: string;
  nodes: TreeNode[];
  docs: { meta: DocMeta; text: string }[];
  /** true: place the items where the pointer is; false: add them to Ungrouped. */
  atCursor: boolean;
}

const uid = () => 'tr-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Start listening for the reply BEFORE the request goes out, so a fast reply isn't missed. */
async function replyWaiter(id: string): Promise<{ wait: (ms: number) => Promise<boolean>; stop: () => void }> {
  let arrived = false;
  let wake: (() => void) | null = null;
  const unlisten = await platform.listenHere<{ id: string }>('transfer-done', (p) => {
    if (p.id !== id) return;
    arrived = true;
    wake?.();
  });
  return {
    wait: (ms) =>
      new Promise<boolean>((resolve) => {
        if (arrived) return resolve(true);
        const timer = setTimeout(() => resolve(arrived), ms);
        wake = () => {
          clearTimeout(timer);
          resolve(true);
        };
      }),
    stop: unlisten,
  };
}

/**
 * Move items (files or file groups) to the window under the pointer, or into a new window there.
 * `mergeInto` sends them to a given window's Ungrouped section instead (closing a window).
 */
export async function sendItems(ids: string[], mergeInto?: string): Promise<boolean> {
  const wanted = ids.filter((i) => !inFlight.has(i));
  const { nodes, docIds } = extractItems(tree.value, wanted);
  if (!nodes.length) return false;
  const id = uid();
  const target = mergeInto ?? (await platform.windowAt());
  const payload: Transfer = { id, from: platform.windowLabel, nodes, docs: await snapshotDocs(docIds), atCursor: !mergeInto };
  const moving = nodes.map((n) => n.id);
  moving.forEach((i) => inFlight.add(i));
  const reply = await replyWaiter(id);
  try {
    await platform.storeWrite(`transfers/${id}.json`, JSON.stringify(payload));
    if (target) await platform.emitTo(target, 'receive-transfer', id);
    else await platform.openWindow(id);
    let ok = await reply.wait(target ? 6000 : 20000);
    if (!ok) {
      // Take the offer back. Winning the claim means the other window never took it.
      const mine = await platform.storeClaim(`transfers/${id}.json`).catch(() => null);
      if (mine !== null) {
        showToast("Couldn't move it to the other window, so it stays here.");
        return false;
      }
      // The other window has it: wait for it to finish, and treat it as moved either way.
      ok = await reply.wait(15000);
    }
    // Remove what moved from the tree as it is NOW (it may have changed during the wait).
    removeDocs(docIds);
    tree.value = extractItems(tree.value, moving).rest;
    if (!mergeInto) {
      if (!orderedIds.value.length) newNote();
      else if (!activeId.value || !docs.value[activeId.value]) activate(orderedIds.value[0]);
    }
    scheduleSession();
    return true;
  } finally {
    reply.stop();
    moving.forEach((i) => inFlight.delete(i));
  }
}

/** Where the pointer is in this window: a file group, before a file, or Ungrouped. */
async function dropSpot(atCursor: boolean): Promise<{ groupId: string | null; beforeId?: string | null }> {
  if (!atCursor) return { groupId: null };
  const pt = await platform.cursorClientPoint().catch(() => null);
  if (!pt) return { groupId: null };
  const el = (document.elementFromPoint(pt.x, pt.y) as HTMLElement | null)?.closest('[data-drop-id]') as HTMLElement | null;
  const id = el?.dataset.dropId;
  if (!id || id === '__root__') return { groupId: null };
  if (el!.dataset.dropKind === 'group') return { groupId: id };
  const loc = T.find(tree.value, id);
  return loc?.parent ? { groupId: loc.parent.id, beforeId: id } : { groupId: null };
}

/** Take in items another window sent: claim, add, save, then confirm. */
export async function receiveTransfer(id: string) {
  const raw = await platform.storeClaim(`transfers/${id}.json`).catch(() => null);
  if (!raw) return; // the sender cancelled, or another window took it
  const t: Transfer = JSON.parse(raw);
  const spot = await dropSpot(t.atCursor);
  importDocs(t.docs);
  tree.value = importItems(tree.value, t.nodes, spot);
  const first = t.docs[0]?.meta.id;
  if (first && docs.value[first]) activate(first);
  await flushAll();
  await saveSessionNow();
  await platform.emitTo(t.from, 'transfer-done', { id });
  await platform.show();
}

/** Closing this window while others are open: hand everything to the last-used other window. */
export async function closeIntoOtherWindow(): Promise<'merged' | 'failed' | 'alone'> {
  const other = await platform.lastOtherWindow();
  if (!other) return 'alone';
  await flushAll();
  const ids = tree.value.map((n) => n.id);
  if (ids.length && !(await sendItems(ids, other))) return 'failed';
  windowClosing.value = true;
  await platform.storeDelete(sessionKey(platform.windowLabel)).catch(() => {});
  await platform.closeWindow();
  return 'merged';
}

/** Quit: every other window saves its unsaved state first (replies are counted by window). */
export async function flushEveryWindow() {
  const others = Math.max(0, (await platform.windowCount()) - 1);
  if (others) {
    const replied = new Set<string>();
    let done: () => void = () => {};
    const all = new Promise<void>((resolve) => (done = resolve));
    const unlisten = await platform.listenHere<{ label: string }>('app-flushed', (p) => {
      replied.add(p.label);
      if (replied.size >= others) done();
    });
    await platform.emit('app-flush', { from: platform.windowLabel });
    await Promise.race([all, new Promise((r) => setTimeout(r, 2500))]);
    unlisten();
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
  platform.listenHere<string>('receive-transfer', (id) => void receiveTransfer(id));
  platform.listen<{ from: string }>('app-flush', async (p) => {
    if (p.from === platform.windowLabel) return;
    await flushAll();
    await platform.emitTo(p.from, 'app-flushed', { label: platform.windowLabel });
  });
  // Tell the other windows which files this one has open (a file is only open in one window).
  effect(() => {
    const paths = Object.values(docs.value).flatMap((d) => (d.path ? [d.path] : []));
    platform.registerOpenFiles(paths).catch(() => {});
  });
  const transfer = new URLSearchParams(location.search).get('transfer');
  if (transfer) await receiveTransfer(transfer);
  // Leftovers from a crash mid-move: the first window clears transfer files older than a minute.
  if (platform.windowLabel === 'main') {
    for (const f of await platform.storeList('transfers').catch(() => [] as string[])) {
      const made = parseInt(/^tr-([0-9a-z]{8})/.exec(f)?.[1] ?? '', 36); // uid() starts with Date.now() in base 36
      if (!Number.isFinite(made) || Date.now() - made > 60_000) await platform.storeDelete(`transfers/${f}`).catch(() => {});
    }
  }
  updateWindowTitle();
}
