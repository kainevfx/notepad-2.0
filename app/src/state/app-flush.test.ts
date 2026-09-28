import { describe, it, expect, vi } from 'vitest';
// Every platform call is a harmless async no-op.
vi.mock('../platform', () => ({ platform: new Proxy({}, { get: () => async () => null }), isTauri: false }));
import { newNote, closeDoc, reloadDoc, onQuickNoteUpdated } from './app';
import { visualApi } from '../editor/visual/sync';

describe('pending Visual edits are written before a tab is closed or reloaded', () => {
  it('closeDoc flushes first', async () => {
    const flush = vi.fn();
    visualApi.flush = flush;
    const id = newNote({ text: 'x', activate: false });
    await closeDoc(id, { skipPrompt: true });
    expect(flush).toHaveBeenCalled();
  });
  it('reloadDoc flushes first', async () => {
    const flush = vi.fn();
    visualApi.flush = flush;
    const id = newNote({ text: 'x', activate: false });
    await reloadDoc(id, true).catch(() => {});
    expect(flush).toHaveBeenCalled();
  });
  it('a quick note update flushes first', () => {
    const flush = vi.fn();
    visualApi.flush = flush;
    const id = newNote({ text: 'x', activate: false });
    onQuickNoteUpdated({ id, text: 'y', from: 'quicknote' });
    expect(flush).toHaveBeenCalled();
  });
});
