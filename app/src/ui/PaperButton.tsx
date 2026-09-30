// The Paper button (Grid, Lines, Code, None and page margin), shown with the tab controls:
// in the sidebar's New row, at the right end of the top tab strip, and at the top of the rails.
import { paperPopoverOpen } from '../state/ui';
import { activeDoc, effectivePaper } from '../state/app';
import { IcGrid, IcLines, IcNumbers, IcNone } from './icons';
import { PaperPopover } from './PaperPopover';

export function PaperButton({ label = true, cls = '' }: { label?: boolean; cls?: string }) {
  const paper = effectivePaper(activeDoc.value);
  const Icon = paper === 'grid' ? IcGrid : paper === 'lines' ? IcLines : paper === 'numbers' ? IcNumbers : IcNone;
  return (
    <div class={`paper-anchor ${cls}`}>
      <button
        class={`${label ? 'side-action' : 'icon-btn'}${paperPopoverOpen.value ? ' pressed' : ''}`}
        title="Paper: Grid, Lines, Code, None, and page margin"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => (paperPopoverOpen.value = !paperPopoverOpen.value)}
      >
        <Icon />
        {label && <span>Paper</span>}
      </button>
      {paperPopoverOpen.value && <PaperPopover />}
    </div>
  );
}
