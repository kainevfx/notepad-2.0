// JSON, YAML and XML as one collapsible tree model for the tree viewer. Parse errors come back
// with a line number when the parser gives one, never as a throw.
import { parseDocument } from 'yaml';

export type TNode =
  | { t: 'obj'; key?: string; children: TNode[] }
  | { t: 'arr'; key?: string; children: TNode[] }
  | { t: 'val'; key?: string; value: string; vt: 'string' | 'number' | 'bool' | 'null' }
  | { t: 'el'; key?: string; name: string; attrs: [string, string][]; children: TNode[] }
  | { t: 'text'; value: string };

export type TreeResult = { ok: true; root: TNode } | { ok: false; message: string; line: number | null };

function fromValue(v: unknown, key?: string): TNode {
  const k = key === undefined ? {} : { key };
  if (Array.isArray(v)) return { t: 'arr', ...k, children: v.map((x, i) => fromValue(x, String(i))) };
  if (v instanceof Date) return { t: 'val', ...k, value: v.toISOString(), vt: 'string' };
  if (v && typeof v === 'object') return { t: 'obj', ...k, children: Object.entries(v).map(([kk, x]) => fromValue(x, kk)) };
  if (v === null || v === undefined) return { t: 'val', ...k, value: 'null', vt: 'null' };
  if (typeof v === 'number' || typeof v === 'bigint') return { t: 'val', ...k, value: String(v), vt: 'number' };
  if (typeof v === 'boolean') return { t: 'val', ...k, value: String(v), vt: 'bool' };
  return { t: 'val', ...k, value: String(v), vt: 'string' };
}

const lineAt = (text: string, pos: number) => text.slice(0, pos).split('\n').length;

export function jsonTree(text: string): TreeResult {
  try {
    return { ok: true, root: fromValue(JSON.parse(text)) };
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    const line = /line (\d+)/.exec(msg);
    const pos = /position (\d+)/.exec(msg);
    return { ok: false, message: msg, line: line ? Number(line[1]) : pos ? lineAt(text, Number(pos[1])) : null };
  }
}

export function yamlTree(text: string): TreeResult {
  try {
    const doc = parseDocument(text, { prettyErrors: true });
    const err = doc.errors[0];
    if (err) return { ok: false, message: err.message.split('\n')[0], line: err.linePos?.[0]?.line ?? null };
    return { ok: true, root: fromValue(doc.toJS({ maxAliasCount: 100 })) };
  } catch (e) {
    return { ok: false, message: String(e), line: null };
  }
}

function fromXml(el: Element): TNode {
  const children: TNode[] = [];
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 1) children.push(fromXml(n as Element));
    else if ((n.nodeType === 3 || n.nodeType === 4) && n.textContent?.trim()) children.push({ t: 'text', value: n.textContent.trim() });
  }
  return { t: 'el', name: el.nodeName, attrs: Array.from(el.attributes).map((a) => [a.name, a.value] as [string, string]), children };
}

export function xmlTree(text: string, parse?: (s: string) => Document): TreeResult {
  try {
    const doc = (parse ?? ((s) => new DOMParser().parseFromString(s, 'application/xml')))(text);
    const bad = doc.getElementsByTagName('parsererror')[0];
    if (bad || !doc.documentElement) {
      const msg = (bad?.textContent ?? 'Not a valid XML document').trim();
      const line = /line (?:number )?(\d+)/i.exec(msg);
      return { ok: false, message: msg.split('\n')[0], line: line ? Number(line[1]) : null };
    }
    return { ok: true, root: fromXml(doc.documentElement) };
  } catch (e) {
    return { ok: false, message: String(e), line: null };
  }
}

const isBranch = (n: TNode): n is Extract<TNode, { children: TNode[] }> => 'children' in n;

export function countNodes(n: TNode): number {
  return 1 + (isBranch(n) ? n.children.reduce((s, c) => s + countNodes(c), 0) : 0);
}

/** Paths ("" root, "/0", "/0/2"…) of every branch shallower than maxDepth. */
export function branchPaths(n: TNode, maxDepth: number, path = '', depth = 0, out = new Set<string>()): Set<string> {
  if (!isBranch(n)) return out;
  if (depth < maxDepth) out.add(path);
  n.children.forEach((c, i) => branchPaths(c, maxDepth, `${path}/${i}`, depth + 1, out));
  return out;
}

/** Above this many nodes a tree opens with only the root expanded (and Expand all is off). */
export const BIG_TREE = 2000;

export function defaultOpenPaths(root: TNode): Set<string> {
  return countNodes(root) > BIG_TREE ? new Set(['']) : branchPaths(root, 2);
}

export function treeFor(path: string | null, text: string): TreeResult {
  if (path && /\.ya?ml$/i.test(path)) return yamlTree(text);
  if (path && /\.xml$/i.test(path)) return xmlTree(text);
  return jsonTree(text);
}
