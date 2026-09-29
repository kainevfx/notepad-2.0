import { describe, it, expect } from 'vitest';
import { GUIDE_STEPS } from './guide-steps';

// All UI source (as text), to check every step points at something the app really renders.
const files = (import.meta as any).glob('./*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const source = Object.values(files).join('\n');

describe('startup guide steps', () => {
  it('has a welcome and a finish, and a dozen steps in between at most', () => {
    expect(GUIDE_STEPS[0].target).toBeUndefined();
    expect(GUIDE_STEPS[GUIDE_STEPS.length - 1].target).toBeUndefined();
    expect(GUIDE_STEPS.length).toBeGreaterThanOrEqual(10);
    expect(GUIDE_STEPS.length).toBeLessThanOrEqual(14);
  });
  it('every step has a title and short text', () => {
    for (const s of GUIDE_STEPS) {
      expect(s.title.length).toBeGreaterThan(2);
      expect(s.text.length).toBeGreaterThan(20);
      expect(s.text.length).toBeLessThan(420);
    }
  });
  it('every target class exists in the UI components', () => {
    for (const s of GUIDE_STEPS) {
      for (const sel of s.target ?? []) {
        const cls = /\.([a-z][\w-]*)/.exec(sel)?.[1];
        expect(cls, `${s.title}: ${sel}`).toBeTruthy();
        expect(source.includes(cls!), `${s.title}: class ${cls} not found in src/ui`).toBe(true);
      }
    }
  });
});
