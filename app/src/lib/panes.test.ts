import { describe, it, expect } from 'vitest';
import { SINGLE, other, loadInto, focus, toggle, onRemoved, viewFor, setView, setRatio, restore, type PaneState } from './panes';

const two = (a: string, b: string, active: 'a' | 'b' = 'a'): PaneState => ({ ...SINGLE, on: true, active, docs: { a, b } });

describe('panes', () => {
  it('other', () => {
    expect(other('a')).toBe('b');
    expect(other('b')).toBe('a');
  });

  it('a tab loads into the active pane only', () => {
    expect(loadInto(two('x', 'y', 'b'), 'z').docs).toEqual({ a: 'x', b: 'z' });
    expect(loadInto({ ...SINGLE, docs: { a: 'x', b: null } }, 'z').docs.a).toBe('z');
  });
  it("loading clears that pane's own view override (and the other's, once the sides differ)", () => {
    const s = { ...two('x', 'x'), override: { a: 'edit' as const, b: 'visual' as const } };
    expect(loadInto(s, 'z').override).toEqual({ a: null, b: null });
  });

  it('focus', () => expect(focus(two('x', 'y'), 'b').active).toBe('b'));
  it('focus does nothing when split is off', () => expect(focus({ ...SINGLE, docs: { a: 'x', b: null } }, 'b').active).toBe('a'));

  it('turning split on shows the next tab on the right, active stays left', () => {
    const s = toggle({ ...SINGLE, docs: { a: 'x', b: null } }, ['w', 'x', 'y']);
    expect(s.on).toBe(true);
    expect(s.docs).toEqual({ a: 'x', b: 'y' });
    expect(s.active).toBe('a');
  });
  it('turning split on with the last tab active shows the previous one', () =>
    expect(toggle({ ...SINGLE, docs: { a: 'y', b: null } }, ['x', 'y']).docs.b).toBe('x'));
  it('turning split on with a single tab shows it on both sides', () =>
    expect(toggle({ ...SINGLE, docs: { a: 'x', b: null } }, ['x']).docs.b).toBe('x'));
  it("turning split off keeps the active pane's document", () => {
    const s = toggle(two('x', 'y', 'b'), ['x', 'y']);
    expect(s.on).toBe(false);
    expect(s.docs.a).toBe('y');
    expect(s.active).toBe('a');
  });

  it('removing a document moves every pane that showed it', () => {
    expect(onRemoved(two('x', 'y'), ['y'], () => 'z').docs).toEqual({ a: 'x', b: 'z' });
    expect(onRemoved(two('x', 'x'), ['x'], () => 'z').docs).toEqual({ a: 'z', b: 'z' });
  });
  it('with nothing left the pane shows the other side', () => expect(onRemoved(two('x', 'y'), ['y'], () => null).docs.b).toBe('x'));

  it('a view override only applies when both sides show the same document', () => {
    const s = { ...two('x', 'x'), override: { a: null, b: 'edit' as const } };
    expect(viewFor(s, 'b', 'visual')).toBe('edit');
    expect(viewFor(s, 'a', 'visual')).toBe('visual');
    const t = { ...two('x', 'y'), override: { a: null, b: 'edit' as const } };
    expect(viewFor(t, 'b', 'visual')).toBe('visual');
  });
  it('where a view change is stored', () => {
    expect(setView(two('x', 'x'), 'b')).toBe('override');
    expect(setView(two('x', 'y'), 'b')).toBe('doc');
    expect(setView({ ...SINGLE, docs: { a: 'x', b: 'x' } }, 'a')).toBe('doc');
  });

  it('ratio is clamped', () => {
    expect(setRatio(SINGLE, 0.05).ratio).toBe(0.2);
    expect(setRatio(SINGLE, 0.95).ratio).toBe(0.8);
    expect(setRatio(SINGLE, 0.6).ratio).toBe(0.6);
  });

  it('restore keeps valid state', () => {
    const raw = { on: true, ratio: 0.4, active: 'b', docs: { a: 'x', b: 'x' }, override: { a: null, b: 'edit' } };
    expect(restore(raw, () => true, 'x')).toEqual(raw);
  });
  it('restore replaces a missing document with the fallback', () =>
    expect(restore({ on: true, ratio: 0.5, active: 'a', docs: { a: 'x', b: 'gone' } }, (id) => id === 'x', 'x').docs).toEqual({ a: 'x', b: 'x' }));
  it('restore of garbage is a single pane', () => {
    expect(restore(null, () => true, 'x')).toEqual({ ...SINGLE, docs: { a: 'x', b: null } });
    expect(restore({ on: 'yes', ratio: 'wide', active: 'c' }, () => true, 'x')).toEqual({ ...SINGLE, docs: { a: 'x', b: null } });
  });
});

describe('stale view overrides', () => {
  it('loading a different document into the other pane clears both overrides', () => {
    const s = { ...two('x', 'x', 'b'), override: { a: 'edit' as const, b: 'visual' as const } };
    expect(loadInto(s, 'y').override).toEqual({ a: null, b: null });
  });
  it('removing a document clears overrides once the sides differ, and never carries them to a new shared doc', () => {
    const s = { ...two('x', 'x'), override: { a: 'edit' as const, b: null } };
    expect(onRemoved(s, ['x'], () => 'z').override).toEqual({ a: null, b: null });
  });
  it('overrides stay while both sides still show the same document', () => {
    const s = { ...two('x', 'x'), override: { a: 'edit' as const, b: null } };
    expect(focus(s, 'b').override).toEqual({ a: 'edit', b: null });
  });
});
