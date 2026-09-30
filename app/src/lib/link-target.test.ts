import { describe, it, expect } from 'vitest';
import { resolveLinkTarget as r, relativeLink } from './link-target';

const doc = 'C:\\Proj\\docs\\plan.md';

describe('resolveLinkTarget', () => {
  it('anchor', () => expect(r('#Cast%20list', doc)).toEqual({ kind: 'anchor', id: 'Cast list' }));
  it('web and mail', () => {
    expect(r('https://x.com/a', doc)).toEqual({ kind: 'web', url: 'https://x.com/a' });
    expect(r('mailto:a@b.c', doc)).toEqual({ kind: 'web', url: 'mailto:a@b.c' });
  });
  it('relative file with fragment', () => expect(r('ledger.md#totals', doc)).toEqual({ kind: 'path', path: 'C:\\Proj\\docs\\ledger.md' }));
  it('relative folder with %20 and trailing slash', () => expect(r('../My%20Assets/', doc)).toEqual({ kind: 'path', path: 'C:\\Proj\\My Assets' }));
  it('drive paths both slash styles', () => {
    expect(r('C:\\Art\\Chars', doc)).toEqual({ kind: 'path', path: 'C:\\Art\\Chars' });
    expect(r('D:/Art/Chars/', doc)).toEqual({ kind: 'path', path: 'D:\\Art\\Chars' });
  });
  it('file URL', () => expect(r('file:///C:/Art/My%20Folder', doc)).toEqual({ kind: 'path', path: 'C:\\Art\\My Folder' }));
  it('UNC', () => expect(r('\\\\nas\\share\\x', doc)).toEqual({ kind: 'path', path: '\\\\nas\\share\\x' }));
  it('relative link in an unsaved note', () => expect(r('images/a.png', null)).toEqual({ kind: 'needs-save' }));
  it('empty', () => expect(r('', doc)).toEqual({ kind: 'none' }));
  it('an escaped % decodes to a literal %', () => expect(r('100%25 done.md', doc)).toEqual({ kind: 'path', path: 'C:\\Proj\\docs\\100% done.md' }));
  it('a bare % that is not an escape survives', () => expect(r('50% off.md', doc)).toEqual({ kind: 'path', path: 'C:\\Proj\\docs\\50% off.md' }));
  it('cannot climb above the drive', () => expect(r('../../../../x', doc)).toEqual({ kind: 'path', path: 'C:\\x' }));
});

describe('relativeLink', () => {
  it('same folder', () => expect(relativeLink('C:\\Proj\\docs\\ledger.md', doc)).toBe('ledger.md'));
  it('sibling folder, spaces encoded', () => expect(relativeLink('C:\\Proj\\My Assets', doc, true)).toBe('../My%20Assets/'));
  it('other drive stays absolute', () => expect(relativeLink('D:\\x\\y.csv', doc)).toBe('file:///D:/x/y.csv'));
  it('unsaved doc stays absolute', () => expect(relativeLink('C:\\a b\\c.txt', null)).toBe('file:///C:/a%20b/c.txt'));
  it('round trips through resolveLinkTarget', () => {
    const t = 'C:\\Proj\\Art & Refs\\Hero #1.png';
    expect(r(relativeLink(t, doc), doc)).toEqual({ kind: 'path', path: t });
  });
});

describe('network shares', () => {
  it('file://host/share maps to a UNC path', () => expect(r('file://nas/share/Assets/', doc)).toEqual({ kind: 'path', path: '\\\\nas\\share\\Assets' }));
  it('a link to a share is written as file://host/share', () =>
    expect(relativeLink('\\\\nas\\share\\Assets', doc, true)).toBe('file://nas/share/Assets/'));
  it('that link resolves back to the share', () =>
    expect(r(relativeLink('\\\\nas\\share\\A b', doc), doc)).toEqual({ kind: 'path', path: '\\\\nas\\share\\A b' }));
  it('a different server is never made relative', () =>
    expect(relativeLink('\\\\nas2\\s\\x', '\\\\nas\\share\\docs\\plan.md')).toBe('file://nas2/s/x'));
  it('the same share is relative', () => expect(relativeLink('\\\\nas\\share\\img\\a.png', '\\\\nas\\share\\docs\\plan.md')).toBe('../img/a.png'));
});
