import { describe, it, expect, vi } from 'vitest';
vi.mock('../platform', () => ({ platform: {} }));
import { migrateMdView, clampScale, DEFAULT_SETTINGS } from './settings';

describe('migrateMdView', () => {
  it('maps the old preview-only view to visual', () => expect(migrateMdView('preview')).toBe('visual'));
  it('keeps valid views', () => {
    expect(migrateMdView('edit')).toBe('edit');
    expect(migrateMdView('split')).toBe('split');
    expect(migrateMdView('visual')).toBe('visual');
  });
  it('falls back to visual for junk', () => expect(migrateMdView(undefined)).toBe('visual'));
});

describe('clampScale', () => {
  it('clamps to 75-150 in steps of 5', () => {
    expect(clampScale(10)).toBe(75);
    expect(clampScale(999)).toBe(150);
    expect(clampScale(112)).toBe(110);
  });
});

describe('defaults', () => {
  it('opens markdown in visual and UI at 100%', () => {
    expect(DEFAULT_SETTINGS.mdDefaultView).toBe('visual');
    expect(DEFAULT_SETTINGS.uiScale).toBe(100);
  });
});
