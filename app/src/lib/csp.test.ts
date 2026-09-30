import { describe, it, expect } from 'vitest';
import conf from '../../src-tauri/tauri.conf.json';

// HTML pages in the viewer frame inherit the app's CSP: their stylesheets and fonts load from
// the asset protocol (the <base> points there), so style-src and font-src must allow it.
describe('content security policy', () => {
  const csp: string = conf.app.security.csp;
  const directive = (name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' ')) ?? '';
  it('stylesheets and fonts from next to an HTML file are allowed', () => {
    expect(directive('style-src')).toContain('http://asset.localhost');
    expect(directive('font-src')).toContain('http://asset.localhost');
  });
  it('scripts stay local only', () => expect(directive('script-src')).toBe("script-src 'self'"));
});
