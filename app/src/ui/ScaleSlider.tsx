// Interface size: scales the whole app (webview zoom), separate from the editor's text zoom.
import { settings, updateSettings, clampScale } from '../state/settings';

export function ScaleSlider({ compact = false }: { compact?: boolean }) {
  const v = settings.value.uiScale;
  return (
    <label class={`scale-slider${compact ? ' compact' : ''}`} title="Interface size (double-click the number to reset)">
      {!compact && <span>Interface size</span>}
      <input
        type="range"
        min={75}
        max={150}
        step={5}
        value={v}
        aria-label="Interface size"
        onInput={(e) => updateSettings({ uiScale: clampScale(Number((e.target as HTMLInputElement).value)) })}
      />
      <span class="scale-val" onDblClick={() => updateSettings({ uiScale: 100 })}>
        {v}%
      </span>
    </label>
  );
}
