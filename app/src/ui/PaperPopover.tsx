import { useEffect } from 'preact/hooks';
import { paperPopoverOpen } from '../state/ui';
import { settings, updateSettings, type PaperMode } from '../state/settings';
import { activeDoc, effectivePaper, setPaper, refreshView } from '../state/app';
import { IcGrid, IcLines, IcNumbers, IcNone } from './icons';
import { MarginControl } from './MarginControl';

const MODES: { mode: PaperMode; label: string; Icon: typeof IcGrid }[] = [
  { mode: 'grid', label: 'Grid', Icon: IcGrid },
  { mode: 'lines', label: 'Lines', Icon: IcLines },
  { mode: 'numbers', label: 'Code', Icon: IcNumbers },
  { mode: 'none', label: 'None', Icon: IcNone },
];

export function PaperPopover() {
  const current = effectivePaper(activeDoc.value);
  const s = settings.value;
  useEffect(() => {
    const close = () => (paperPopoverOpen.value = false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', key);
    };
  }, []);
  return (
    <div class="paper-pop" onPointerDown={(e) => e.stopPropagation()}>
      <div class="paper-modes">
        {MODES.map(({ mode, label, Icon }) => (
          <button
            key={mode}
            class={`paper-mode${current === mode ? ' on' : ''}`}
            onClick={() => {
              setPaper(mode);
              paperPopoverOpen.value = false;
            }}
          >
            <Icon size={26} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div class="paper-margin-row">
        <MarginControl />
      </div>
      <label class="paper-opt">
        <input
          type="checkbox"
          checked={s.paperNumbers}
          onChange={() => {
            updateSettings({ paperNumbers: !s.paperNumbers });
            refreshView();
          }}
        />
        Also show line numbers on Grid and Lines
      </label>
      <label class="paper-opt">
        <input
          type="checkbox"
          checked={s.paperMargin}
          onChange={() => {
            updateSettings({ paperMargin: !s.paperMargin });
            refreshView();
          }}
        />
        Red margin rule on Lines
      </label>
      <label class="paper-opt">
        <input type="checkbox" checked={s.paperPerTab} onChange={() => updateSettings({ paperPerTab: !s.paperPerTab })} />
        Remember per tab
      </label>
    </div>
  );
}
