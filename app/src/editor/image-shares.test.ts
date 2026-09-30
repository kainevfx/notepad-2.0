import { describe, it, expect } from 'vitest';
import { resolveImageUrl } from './insert';
import { renderMarkdown } from '../markdown/pipeline';

const asset = (p: string) => 'asset:' + p;

// C1: an image pointing at another computer's share must never be fetched just by opening a
// document (Windows would try to sign in to that server).
describe('images on network shares', () => {
  it('protocol-relative, file://host and UNC images from a local document are not loaded', () => {
    for (const u of ['//evil.example/share/a.png', 'file://evil.example/share/a.png', '\\\\evil.example\\share\\a.png'])
      expect(resolveImageUrl('C:/Docs', u, asset), u).toBe('');
  });
  it('a document on a share loads images from that same share', () => {
    expect(resolveImageUrl('\\\\nas\\team\\docs', '../img/a.png', asset)).toBe('asset:\\\\nas\\team\\img\\a.png');
    expect(resolveImageUrl('\\\\nas\\team\\docs', '\\\\nas\\team\\img\\b.png', asset)).toBe('asset:\\\\nas\\team\\img\\b.png');
  });
  it('...but not from a different server or share', () => {
    expect(resolveImageUrl('\\\\nas\\team\\docs', '\\\\evil\\s\\x.png', asset)).toBe('');
    expect(resolveImageUrl('\\\\nas\\team\\docs', '\\\\nas\\other\\x.png', asset)).toBe('');
  });
  it('the preview never keeps such a source, with or without blocking remote images', () => {
    for (const block of [false, true]) {
      const html = renderMarkdown('![x](//evil.example/s/a.png) ![y](file://evil.example/s/b.png)', { blockRemoteImages: block, resolveUrl: (u) => resolveImageUrl('C:/Docs', u, asset) });
      expect(html).not.toContain('evil.example');
    }
  });
  it('local images still load', () => expect(resolveImageUrl('C:/Docs', 'pics/a b.png', asset)).toBe('asset:C:\\Docs\\pics\\a b.png'));
});
