import type { GroupColor } from '../lib/tree-ops';

// Chrome's tab-group palette: [light theme, dark theme].
export const GROUP_PALETTE: Record<GroupColor, [string, string]> = {
  grey: ['#5f6368', '#dadce0'],
  blue: ['#1a73e8', '#8ab4f8'],
  red: ['#d93025', '#f28b82'],
  yellow: ['#e37400', '#fdd663'],
  green: ['#188038', '#81c995'],
  pink: ['#d01884', '#ff8bcb'],
  purple: ['#9334e6', '#c58af9'],
  cyan: ['#007b83', '#78d9ec'],
  orange: ['#fa7b17', '#fcad70'],
};

export const GROUP_HEX: Record<GroupColor, string> = Object.fromEntries(
  Object.entries(GROUP_PALETTE).map(([k, v]) => [k, v[1]]),
) as Record<GroupColor, string>;

export function groupVars(color: GroupColor): Record<string, string> {
  const [light, dark] = GROUP_PALETTE[color];
  return { '--g-light': light, '--g-dark': dark };
}
