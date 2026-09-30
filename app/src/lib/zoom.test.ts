import { describe, it, expect } from 'vitest';
import { stepZoom, fitScale } from './zoom';

describe('stepZoom', () => {
  it('multiplies and clamps', () => {
    expect(stepZoom(1, 1)).toBeCloseTo(1.1);
    expect(stepZoom(1, -1)).toBeCloseTo(1 / 1.1);
    expect(stepZoom(16, 1)).toBe(16);
    expect(stepZoom(0.05, -1)).toBe(0.05);
  });
});

describe('fitScale', () => {
  it('shrinks big images to fit, never enlarges small ones', () => {
    expect(fitScale(2000, 1000, 1000, 1000)).toBe(0.5);
    expect(fitScale(1000, 3000, 1000, 1000)).toBeCloseTo(1 / 3);
    expect(fitScale(100, 50, 1000, 1000)).toBe(1);
  });
  it('an empty stage or image is 1', () => expect(fitScale(0, 0, 800, 600)).toBe(1));
});
