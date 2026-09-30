// Paper styles in the Visual view: drawn as a page background at the line height of the current
// font size and zoom, behind the formatted text (headings and images don't snap to the lines,
// like real paper). Code paper shows faint rules only: Visual has no source lines to number.
import type { PaperMode, Settings } from '../../state/settings';
import { lineHeightPx } from '../setup';

export function visualPaper(paper: PaperMode, s: Settings): { cls: string; vars: Record<string, string> } {
  const kind = paper === 'numbers' ? 'code' : paper;
  const margin = paper === 'lines' && s.paperMargin ? ' vpaper-margin' : '';
  return { cls: `vpaper vpaper-${kind}${margin}`, vars: { '--vlh': `${lineHeightPx(s)}px` } };
}
