import { describe, it, expect, vi } from 'vitest';
vi.mock('../platform', () => ({ platform: { setTitle: async () => {}, storeWrite: async () => {}, emit: async () => {} } }));
import { PLAIN_ALLOWED, plainTarget, sourceTarget, visualTarget, targetFor } from './format';
import type { DocMeta } from '../state/app';

const doc = (p: Partial<DocMeta>): DocMeta => ({ language: 'plain', mdView: 'edit', ...p }) as DocMeta;

describe('format targets', () => {
  it('plain text only allows plain-safe commands', () => {
    expect([...PLAIN_ALLOWED].sort()).toEqual(['fontSize', 'fontWeight', 'indent', 'outdent', 'wrap']);
    expect(plainTarget.can('bold')).toBe(false);
    expect(plainTarget.can('color')).toBe(false);
    expect(plainTarget.can('table')).toBe(false);
    expect(plainTarget.can('wrap')).toBe(true);
    expect(plainTarget.can('indent')).toBe(true);
  });
  it('picks the target from the tab', () => {
    expect(targetFor(null)).toBe(plainTarget);
    expect(targetFor(doc({ language: 'plain' }))).toBe(plainTarget);
    expect(targetFor(doc({ language: 'markdown', mdView: 'visual' }))).toBe(visualTarget);
    expect(targetFor(doc({ language: 'markdown', mdView: 'edit' }))).toBe(sourceTarget);
    expect(targetFor(doc({ language: 'markdown', mdView: 'split' }))).toBe(sourceTarget);
  });
});

describe('read-only tabs', () => {
  it('no formatting is offered on a read-only tab, only word wrap', () => {
    for (const d of [doc({ readonly: true }), doc({ readonly: true, language: 'markdown', mdView: 'edit' }), doc({ readonly: true, language: 'markdown', mdView: 'visual' })]) {
      const t = targetFor(d);
      expect(t.can('bold')).toBe(false);
      expect(t.can('indent')).toBe(false);
      expect(t.can('wrap')).toBe(true);
    }
  });
});
