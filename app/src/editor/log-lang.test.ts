import { describe, it, expect } from 'vitest';
import { logLineClass } from './log-lang';

describe('logLineClass', () => {
  it('levels', () => {
    expect(logLineClass('2026-09-27 09:14 ERROR boom')).toBe('error');
    expect(logLineClass('[FATAL] x')).toBe('error');
    expect(logLineClass('WARN disk 91%')).toBe('warn');
    expect(logLineClass('warning: x')).toBe('warn');
    expect(logLineClass('INFO boot ok')).toBe('info');
    expect(logLineClass('DEBUG x')).toBe('debug');
    expect(logLineClass('TRACE x')).toBe('debug');
    expect(logLineClass('plain line')).toBe(null);
    expect(logLineClass('errors=0 summary')).toBe(null);
  });
});
