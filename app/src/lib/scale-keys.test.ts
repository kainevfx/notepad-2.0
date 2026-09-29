import { describe, it, expect } from 'vitest';
import { uiScaleStep } from './scale-keys';

const k = (key: string, code: string, o: { shift?: boolean; ctrl?: boolean; inText?: boolean } = {}) =>
  uiScaleStep({ key, code, shiftKey: !!o.shift, ctrlKey: !!o.ctrl, altKey: false }, !!o.inText);

describe('interface size keys', () => {
  it('Shift + plus / minus nudge by 5 outside the text', () => {
    expect(k('+', 'Equal', { shift: true })).toBe(5);
    expect(k('_', 'Minus', { shift: true })).toBe(-5);
    expect(k('+', 'NumpadAdd', { shift: true })).toBe(5);
    expect(k('-', 'NumpadSubtract', { shift: true })).toBe(-5);
  });
  it('Shift + plus / minus still type + and _ inside the text', () => {
    expect(k('+', 'Equal', { shift: true, inText: true })).toBe(0);
    expect(k('_', 'Minus', { shift: true, inText: true })).toBe(0);
  });
  it('Ctrl+Shift + plus / minus nudge from anywhere', () => {
    expect(k('+', 'Equal', { shift: true, ctrl: true, inText: true })).toBe(5);
    expect(k('_', 'Minus', { shift: true, ctrl: true, inText: true })).toBe(-5);
  });
  it('Ctrl alone is text zoom, not interface size; plain keys do nothing', () => {
    expect(k('=', 'Equal', { ctrl: true })).toBe(0);
    expect(k('=', 'Equal')).toBe(0);
    expect(k('a', 'KeyA', { shift: true })).toBe(0);
  });
});
