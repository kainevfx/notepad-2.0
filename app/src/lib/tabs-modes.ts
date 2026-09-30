// The four tab layouts: along the top, a sidebar on the left, a collapsed rail, and the compact
// rail with vertical labels.
import type { TabsMode } from '../state/settings';

export const TABS_MODES: { mode: TabsMode; label: string; hint: string }[] = [
  { mode: 'top', label: 'Top', hint: 'Tabs along the top' },
  { mode: 'left', label: 'Left', hint: 'A sidebar down the left' },
  { mode: 'rail', label: 'Rail', hint: 'A collapsed rail of file groups' },
  { mode: 'compact', label: 'Compact', hint: 'A thin strip with vertical labels' },
];

export function nextTabsMode(m: TabsMode): TabsMode {
  const i = TABS_MODES.findIndex((t) => t.mode === m);
  return TABS_MODES[(i + 1) % TABS_MODES.length].mode;
}

export function tabsModeLabel(m: TabsMode): string {
  return `Tabs: ${TABS_MODES.find((t) => t.mode === m)?.label ?? 'Top'}`;
}
