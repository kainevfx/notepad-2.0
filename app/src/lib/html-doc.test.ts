import { describe, it, expect } from 'vitest';
import { prepareHtml, assetDirBase } from './html-doc';

describe('prepareHtml', () => {
  it('adds a base into head', () =>
    expect(prepareHtml('<html><head><title>t</title></head><body>x</body></html>', 'http://asset.localhost/C%3A/p/', false)).toContain(
      '<head><base href="http://asset.localhost/C%3A/p/"><title>',
    ));
  it('head with attributes', () => expect(prepareHtml('<HEAD lang="en"><title>t</title></HEAD>', 'B/', false)).toContain('<HEAD lang="en"><base href="B/"><title>'));
  it('adds head when missing', () => expect(prepareHtml('<p>x</p>', 'B/', false)).toBe('<head><base href="B/"></head><p>x</p>'));
  it('does not add a second base', () => expect(prepareHtml('<head><base href="https://x/"></head>', 'B/', false).match(/<base/g)!.length).toBe(1));
  it('quotes in the base href are escaped', () => expect(prepareHtml('<p>x</p>', 'a"b/', false)).toContain('<base href="a&quot;b/">'));
  it('strips remote images and css urls when blocked', () => {
    const out = prepareHtml('<img src="https://t.co/a.png"><div style="background:url(http://x/y.png)"></div><img src="a.png"><img srcset=\'https://z/1.png 2x\'>', null, true);
    expect(out).not.toContain('https://t.co');
    expect(out).not.toContain('http://x/');
    expect(out).not.toContain('https://z/');
    expect(out).toContain('src="a.png"');
  });
  it('keeps remote images when not blocked', () => expect(prepareHtml('<img src="https://t.co/a.png">', null, false)).toContain('https://t.co/a.png'));
});

describe('assetDirBase', () => {
  const asset = (p: string) => 'http://asset.localhost/' + encodeURIComponent(p);
  it('a folder as a slash-separated asset URL ending in /', () =>
    expect(assetDirBase('C:\\My Docs\\site', asset)).toBe('http://asset.localhost/C%3A/My%20Docs/site/'));
  it('a network share keeps its server', () => expect(assetDirBase('\\\\nas\\web', asset)).toBe('http://asset.localhost/%5C%5Cnas/web/'));
  it('a trailing backslash is not doubled', () => expect(assetDirBase('D:\\web\\', asset)).toBe('http://asset.localhost/D%3A/web/'));
});
