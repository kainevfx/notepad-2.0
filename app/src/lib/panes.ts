// Split view as a small pure model: which document each pane shows, which pane is active, the
// divider position, and a per-pane view override used only when both panes show the same
// document (so one side can be Source while the other is Visual). state/panes.ts holds it.
import type { MdView } from '../state/settings';

export type PaneId = 'a' | 'b';

export interface PaneState {
  on: boolean;
  ratio: number;
  active: PaneId;
  docs: { a: string | null; b: string | null };
  override: { a: MdView | null; b: MdView | null };
}

export const SINGLE: PaneState = { on: false, ratio: 0.5, active: 'a', docs: { a: null, b: null }, override: { a: null, b: null } };

export const other = (p: PaneId): PaneId => (p === 'a' ? 'b' : 'a');

/** The active pane shows `id` (its own view override no longer applies). */
export function loadInto(s: PaneState, id: string): PaneState {
  return tidy({ ...s, docs: { ...s.docs, [s.active]: id }, override: { ...s.override, [s.active]: null } });
}

/** A pane's own view only means something while both sides show one document: drop it otherwise. */
function tidy(s: PaneState): PaneState {
  return same(s) || (!s.override.a && !s.override.b) ? s : { ...s, override: { a: null, b: null } };
}

export function focus(s: PaneState, p: PaneId): PaneState {
  return s.on && s.active !== p ? { ...s, active: p } : s;
}

/**
 * On: the right pane shows the tab after the active one (or the one before, or the same one if
 * it is the only tab) and the left stays active. Off: one pane, showing the active pane's document.
 */
export function toggle(s: PaneState, order: string[]): PaneState {
  const cur = s.docs[s.active];
  if (s.on) return { ...SINGLE, ratio: s.ratio, docs: { a: cur, b: null } };
  const i = cur ? order.indexOf(cur) : -1;
  const b = (i >= 0 ? order[i + 1] ?? order[i - 1] : order[0]) ?? cur;
  return { ...s, on: true, active: 'a', docs: { a: cur, b: b ?? null }, override: { a: null, b: null } };
}

/** Documents that closed or moved away: every pane showing one moves to `next(id)` (or the other side). */
export function onRemoved(s: PaneState, ids: string[], next: (removed: string) => string | null): PaneState {
  const gone = new Set(ids);
  const docs = { ...s.docs };
  for (const p of ['a', 'b'] as const) {
    const id = docs[p];
    if (id && gone.has(id)) docs[p] = next(id);
  }
  for (const p of ['a', 'b'] as const) if (!docs[p] && s.on) docs[p] = docs[other(p)];
  const moved = docs.a !== s.docs.a || docs.b !== s.docs.b;
  return tidy({ ...s, docs, override: moved ? { a: null, b: null } : s.override });
}

function same(s: PaneState): boolean {
  return s.on && !!s.docs.a && s.docs.a === s.docs.b;
}

/** The view pane `p` shows: its own override when both sides show one document, else the document's. */
export function viewFor(s: PaneState, p: PaneId, docView: MdView): MdView {
  return (same(s) && s.override[p]) || docView;
}

/** Where a view change made in pane `p` goes. */
export function setView(s: PaneState, _p: PaneId): 'doc' | 'override' {
  return same(s) ? 'override' : 'doc';
}

export function setRatio(s: PaneState, r: number): PaneState {
  return { ...s, ratio: Math.min(0.8, Math.max(0.2, r)) };
}

const isView = (v: unknown): v is MdView => v === 'visual' || v === 'edit' || v === 'split';

/** Pane state from a saved session; anything unknown or missing falls back to something valid. */
export function restore(raw: unknown, exists: (id: string) => boolean, fallback: string | null): PaneState {
  const r = raw as Partial<PaneState> | null;
  const single = { ...SINGLE, docs: { a: fallback, b: null } };
  if (!r || typeof r !== 'object' || typeof r.on !== 'boolean') return single;
  const pick = (id: unknown) => (typeof id === 'string' && exists(id) ? id : fallback);
  const s: PaneState = {
    on: r.on,
    ratio: typeof r.ratio === 'number' ? Math.min(0.8, Math.max(0.2, r.ratio)) : 0.5,
    active: r.active === 'b' && r.on ? 'b' : 'a',
    docs: { a: pick(r.docs?.a), b: r.on ? pick(r.docs?.b) : null },
    override: { a: isView(r.override?.a) ? r.override!.a : null, b: isView(r.override?.b) ? r.override!.b : null },
  };
  // Nothing to show on a side: one pane.
  if (s.on && (!s.docs.a || !s.docs.b)) return { ...SINGLE, ratio: s.ratio, docs: { a: s.docs.a ?? s.docs.b, b: null } };
  return s;
}
