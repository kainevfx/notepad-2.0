import { describe, it, expect, vi } from 'vitest';
vi.mock('../platform', () => ({ platform: {} }));
import { fillerCount } from './code-paper';
import { clampMargin } from '../state/settings';

describe('fillerCount (numbered lines drawn below the text on Code paper)', () => {
  it('fills the rest of the page', () => expect(fillerCount(600, 100, 20)).toBe(25));
  it('rounds up so the page is always full', () => expect(fillerCount(610, 100, 20)).toBe(26));
  it('none when the text is taller than the window', () => expect(fillerCount(600, 900, 20)).toBe(0));
  it('never negative or infinite', () => {
    expect(fillerCount(600, 100, 0)).toBe(0);
    expect(fillerCount(-5, 0, 20)).toBe(0);
  });
});

describe('clampMargin', () => {
  it('keeps 0-200 px, whole numbers', () => {
    expect(clampMargin(-10)).toBe(0);
    expect(clampMargin(999)).toBe(200);
    expect(clampMargin(24.6)).toBe(25);
    expect(clampMargin(Number.NaN)).toBe(24);
  });
});
