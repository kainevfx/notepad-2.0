// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { jsonTree, yamlTree, xmlTree, treeFor } from './tree-model';

describe('jsonTree', () => {
  it('objects, arrays, value types', () => {
    expect(jsonTree('{"a":1,"b":[true,null,"x"]}')).toEqual({
      ok: true,
      root: {
        t: 'obj',
        children: [
          { t: 'val', key: 'a', value: '1', vt: 'number' },
          {
            t: 'arr',
            key: 'b',
            children: [
              { t: 'val', key: '0', value: 'true', vt: 'bool' },
              { t: 'val', key: '1', value: 'null', vt: 'null' },
              { t: 'val', key: '2', value: 'x', vt: 'string' },
            ],
          },
        ],
      },
    });
  });
  it('a top-level value', () => expect(jsonTree('42')).toEqual({ ok: true, root: { t: 'val', value: '42', vt: 'number' } }));
  it('error line', () => {
    const r = jsonTree('{\n  "a": 1,\n  oops\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.line).toBe(3);
  });
  it('empty file is an error, not a crash', () => expect(jsonTree('').ok).toBe(false));
});

describe('yamlTree', () => {
  it('maps and lists', () => {
    const r = yamlTree('name: Kai\ntags:\n  - a\n  - 2\n');
    expect(r.ok && r.root.t === 'obj' && r.root.children.map((c) => ('key' in c ? c.key : null))).toEqual(['name', 'tags']);
  });
  it('dates stay as text', () => {
    const r = yamlTree('when: 2026-09-30');
    expect(r.ok && r.root.t === 'obj' && r.root.children[0]).toEqual({ t: 'val', key: 'when', value: '2026-09-30', vt: 'string' });
  });
  it('error line', () => {
    const r = yamlTree('a: 1\nb: [1, 2\nc: 3');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.line).toBeGreaterThanOrEqual(2);
  });
});

describe('xmlTree', () => {
  it('elements, attributes, text', () => {
    const r = xmlTree('<cast size="2"><p id="a">Ann</p><p/></cast>');
    expect(r.ok).toBe(true);
    if (r.ok && r.root.t === 'el') {
      expect(r.root.name).toBe('cast');
      expect(r.root.attrs).toEqual([['size', '2']]);
      expect(r.root.children.length).toBe(2);
      expect(r.root.children[0]).toEqual({ t: 'el', name: 'p', attrs: [['id', 'a']], children: [{ t: 'text', value: 'Ann' }] });
    }
  });
  it('malformed', () => expect(xmlTree('<a><b></a>').ok).toBe(false));
});

it('treeFor picks by extension', () => {
  expect(treeFor('x.yml', 'a: 1').ok).toBe(true);
  expect(treeFor('x.json', 'a: 1').ok).toBe(false);
});
