// The Paper button (Grid, Lines, Code, None and page margin), shown with the tab controls:
// in the sidebar's New row, at the right end of the top tab strip, and at the top of the rails.
// Several can be on screen (a rail and its peek sidebar), but only one popover opens: the one
// under the button you pressed (or the first one, when View → Paper → Page margin opens it).
import { useEffect, useMemo } from 'preact/hooks';
import { signal } from '@preact/signals';
import { paperPopoverOpen } from '../state/ui';
import { activeDoc, effectivePaper } from '../state/app';
import { IcGrid, IcLines, IcNumbers, IcNone } from './icons';
import { PaperPopover } from './PaperPopover';

let nextId = 1;
const owner = signal<number | null>(null);
const mounted = signal<number[]>([]);

export function PaperButton({ label = true, cls = '' }: { label?: boolean; cls?: string }) {
  const id = useMemo(() => nextId++, []);
  useEffect(() => {
    mounted.value = [...mounted.value, id];
    return () => {
      mounted.value = mounted.value.filter((m) => m !== id);
      // Its button went away (e.g. the rail's peek sidebar closed): close the popover with it.
      if (owner.value === id) {
        owner.value = null;
        paperPopoverOpen.value = false;
      }
    };
  }, [id]);
  const paper = effectivePaper(activeDoc.value);
  const Icon = paper === 'grid' ? IcGrid : paper === 'lines' ? IcLines : paper === 'numbers' ? IcNumbers : IcNone;
  const mine = owner.value === id || (owner.value === null && mounted.value[0] === id);
  const open = paperPopoverOpen.value && mine;
  return (
    <div class={`paper-anchor ${cls}`}>
      <button
        class={`${label ? 'side-action' : 'icon-btn'}${open ? ' pressed' : ''}`}
        title="Paper: Grid, Lines, Code, None, and page margin"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => {
          if (open) paperPopoverOpen.value = false;
          else {
            owner.value = id;
            paperPopoverOpen.value = true;
          }
        }}
      >
        <Icon />
        {label && <span>Paper</span>}
      </button>
      {open && <PaperPopover />}
    </div>
  );
}

/** The next time the popover opens from a menu, it opens under the first Paper button. */
export function resetPaperOwner() {
  owner.value = null;
}
