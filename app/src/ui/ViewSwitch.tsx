// Visual / Source / Split (View / Source / Split for data files), floating in the top-right
// corner of the document.
import type { DocMeta } from '../state/app';
import type { MdView } from '../state/settings';
import { hasViewPane } from '../lib/view-kind';
import { IcEye, IcPencil, IcSplit } from './icons';

export function showsViewSwitch(d: DocMeta | null): boolean {
  return !!d && ((d.language === 'markdown' && !d.viewer) || hasViewPane(d.viewer));
}

export function ViewSwitch({ doc, view, onSet }: { doc: DocMeta; view: MdView; onSet: (v: MdView) => void }) {
  const data = !!doc.viewer;
  return (
    <div class="seg view-switch" role="group" aria-label={data ? 'View' : 'Markdown view'} onPointerDown={(e) => e.stopPropagation()}>
      <button class={view === 'visual' ? 'on' : ''} title={data ? 'Formatted view' : 'Visual editing'} onClick={() => onSet('visual')}>
        <IcEye /> <span>{data ? 'View' : 'Visual'}</span>
      </button>
      <button class={view === 'edit' ? 'on' : ''} title={data ? 'Source text' : 'Markdown source'} onClick={() => onSet('edit')}>
        <IcPencil /> <span>Source</span>
      </button>
      <button class={view === 'split' ? 'on' : ''} title="Source and preview side by side (Ctrl+Shift+V cycles)" onClick={() => onSet('split')}>
        <IcSplit /> <span>Split</span>
      </button>
    </div>
  );
}
