// Pointer-based drag and drop for tabs and groups.
// Not HTML5 DnD on purpose: Tauri keeps native file drops from Explorer (which disable HTML5
// DnD inside WebView2), and pointer events give us exact before / after / inside zones.
import { signal } from '@preact/signals';
import { canMove, type DropPosition } from '../lib/tree-ops';
import { tree, moveNode, moveNodeToRoot } from '../state/app';

export const drag = signal<{ id: string; label: string; x: number; y: number } | null>(null);
export const dropTarget = signal<{ id: string; pos: DropPosition | 'root' } | null>(null);

let suppressClick = false;
/** Call at the top of click handlers on draggable items. */
export function consumeDragClick(): boolean {
  if (suppressClick) {
    suppressClick = false;
    return true;
  }
  return false;
}

function hitTest(x: number, y: number, id: string) {
  const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-drop-id]') as HTMLElement | null;
  if (!el) return null;
  const targetId = el.dataset.dropId!;
  if (targetId === '__root__') return { id: targetId, pos: 'root' as const };
  const kind = el.dataset.dropKind;
  const axis = el.dataset.dropAxis ?? 'y';
  const r = el.getBoundingClientRect();
  const f = axis === 'x' ? (x - r.left) / r.width : (y - r.top) / r.height;
  let pos: DropPosition;
  if (kind === 'group') {
    if (f < 0.25) pos = 'before';
    else if (axis === 'y' && f > 0.75 && el.dataset.collapsed === 'true') pos = 'after';
    else pos = 'inside';
  } else pos = f < 0.5 ? 'before' : 'after';
  if (!canMove(tree.value, id, targetId, pos)) {
    // Fall back to a sibling drop if "inside" isn't allowed (depth cap).
    const alt: DropPosition = f < 0.5 ? 'before' : 'after';
    if (canMove(tree.value, id, targetId, alt)) return { id: targetId, pos: alt };
    return null;
  }
  return { id: targetId, pos };
}

export function startDrag(e: PointerEvent, id: string, label: string) {
  if (e.button !== 0) return;
  const sx = e.clientX;
  const sy = e.clientY;
  let active = false;
  const move = (ev: PointerEvent) => {
    if (!active && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
    active = true;
    drag.value = { id, label, x: ev.clientX, y: ev.clientY };
    dropTarget.value = hitTest(ev.clientX, ev.clientY, id);
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('keydown', esc);
    if (active) {
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
      const t = dropTarget.value;
      if (t) t.pos === 'root' ? moveNodeToRoot(id) : moveNode(id, t.id, t.pos);
    }
    drag.value = null;
    dropTarget.value = null;
  };
  const esc = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      dropTarget.value = null;
      active = false;
      up();
    }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('keydown', esc);
}

export function dropClass(id: string): string {
  const t = dropTarget.value;
  if (!t || t.id !== id) return '';
  return ` drop-${t.pos}`;
}
