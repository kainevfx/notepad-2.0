// Keyboard nudges for the Interface size slider.
//   Shift + / Shift -         outside the text (inside it they type + and _)
//   Ctrl+Shift + / Ctrl+Shift -  anywhere
// Ctrl + / Ctrl - on their own stay text zoom.

type Keyish = { key: string; code: string; shiftKey: boolean; ctrlKey: boolean; altKey: boolean };

const PLUS = new Set(['Equal', 'NumpadAdd']);
const MINUS = new Set(['Minus', 'NumpadSubtract']);

/** +5, -5 or 0 (not an interface-size key). `inText` = focus is in the document or a text box. */
export function uiScaleStep(e: Keyish, inText: boolean): number {
  if (!e.shiftKey || e.altKey) return 0;
  if (inText && !e.ctrlKey) return 0;
  if (PLUS.has(e.code)) return 5;
  if (MINUS.has(e.code)) return -5;
  return 0;
}
