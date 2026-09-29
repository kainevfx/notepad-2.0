// Page margin: space around the text in every view. Slider plus a box to type an exact size.
import { settings, updateSettings, clampMargin } from '../state/settings';

export function MarginControl() {
  const m = settings.value.pageMargin;
  const set = (v: number) => updateSettings({ pageMargin: clampMargin(v) });
  return (
    <label class="margin-control" title="Space between the text and the edges of the page">
      <span>Page margin</span>
      <input type="range" min={0} max={200} step={2} value={m} onInput={(e) => set(Number((e.target as HTMLInputElement).value))} aria-label="Page margin" />
      <input
        type="number"
        min={0}
        max={200}
        value={m}
        class="margin-num"
        onChange={(e) => set(Number((e.target as HTMLInputElement).value))}
        aria-label="Page margin in pixels"
      />
      <span class="margin-unit">px</span>
    </label>
  );
}
