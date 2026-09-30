import { describe, it, expect } from 'vitest';
import { visualPaper } from './paper';
import { lineHeightPx } from '../setup';
import type { Settings } from '../../state/settings';

const s = { fontSize: 11, zoom: 100, paperMargin: false } as Settings;

describe('visualPaper', () => {
  it('grid', () => expect(visualPaper('grid', s).cls).toBe('vpaper vpaper-grid'));
  it('lines, with the red margin rule when on', () => {
    expect(visualPaper('lines', s).cls).toBe('vpaper vpaper-lines');
    expect(visualPaper('lines', { ...s, paperMargin: true }).cls).toBe('vpaper vpaper-lines vpaper-margin');
  });
  it('the margin rule is only for lines', () => expect(visualPaper('grid', { ...s, paperMargin: true }).cls).toBe('vpaper vpaper-grid'));
  it('code paper draws faint rules (no numbers)', () => expect(visualPaper('numbers', s).cls).toBe('vpaper vpaper-code'));
  it('none', () => expect(visualPaper('none', s).cls).toBe('vpaper vpaper-none'));
  it('rule spacing follows the font size and zoom', () => {
    expect(visualPaper('lines', s).vars['--vlh']).toBe(`${lineHeightPx(s)}px`);
    expect(visualPaper('lines', { ...s, zoom: 150 }).vars['--vlh']).toBe(`${lineHeightPx({ ...s, zoom: 150 })}px`);
  });
});
