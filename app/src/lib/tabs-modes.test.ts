import { describe, it, expect } from 'vitest';
import { TABS_MODES, nextTabsMode, tabsModeLabel } from './tabs-modes';

describe('tabs layouts', () => {
  it('four layouts in order', () => expect(TABS_MODES.map((m) => m.label)).toEqual(['Top', 'Left', 'Rail', 'Compact']));
  it('the shortcut cycles through all four', () => {
    expect(nextTabsMode('top')).toBe('left');
    expect(nextTabsMode('left')).toBe('rail');
    expect(nextTabsMode('rail')).toBe('compact');
    expect(nextTabsMode('compact')).toBe('top');
  });
  it('button label', () => expect(tabsModeLabel('compact')).toBe('Tabs: Compact'));
});
