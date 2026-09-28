import { describe, it, expect } from 'vitest';
import { fileBadge } from './file-badge';

describe('fileBadge', () => {
  it('untitled plain note is TXT', () => expect(fileBadge({ language: 'plain', path: null })).toEqual({ label: 'TXT', kind: 'txt' }));
  it('untitled markdown note is MD', () => expect(fileBadge({ language: 'markdown', path: null })).toEqual({ label: 'MD', kind: 'md' }));
  it('.txt file is TXT', () => expect(fileBadge({ language: 'plain', path: 'C:\\a\\b.txt' })).toEqual({ label: 'TXT', kind: 'txt' }));
  it('.markdown file is MD', () => expect(fileBadge({ language: 'markdown', path: '/x/y.markdown' })).toEqual({ label: 'MD', kind: 'md' }));
  it('.log shows its extension', () => expect(fileBadge({ language: 'plain', path: 'C:\\s.log' })).toEqual({ label: 'LOG', kind: 'other' }));
  it('.txt treated as markdown shows MD', () => expect(fileBadge({ language: 'markdown', path: 'C:\\n.txt' })).toEqual({ label: 'MD', kind: 'md' }));
  it('long extension is cut to 4', () => expect(fileBadge({ language: 'plain', path: 'a.config' })).toEqual({ label: 'CONF', kind: 'other' }));
  it('dot in folder name is not an extension', () => expect(fileBadge({ language: 'plain', path: 'C:\\my.dir\\README' })).toEqual({ label: 'TXT', kind: 'txt' }));
});
