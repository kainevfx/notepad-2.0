# Folder links, file viewers and end-of-tab badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Folder links open File Explorer; CSV/TSV, XLSX/XLS/ODS, JSON/YAML/XML, TOML/LOG/INI, HTML, images, PDF and DOCX open in purpose-built viewers; the TXT/MD badge moves to the end of each tab.

**Architecture:** A pure `viewKindFor(path)` gives every opened file a `viewer` kind stored on `DocMeta`. Text-based kinds keep the CodeMirror buffer (Source) and add a View pane; binary kinds (sheet, image, pdf, docx) hold no text and render from the file itself. A single `ViewerPane` routes to lazily loaded viewer components. Link clicks go through a pure `resolveLinkTarget` and a Rust `path_kind` check. Spreadsheets are read in Rust with `calamine`.

**Tech Stack:** Tauri 2 (Rust, calamine 0.31, windows-sys), Preact + signals, CodeMirror 6 (+ @codemirror/language-data), `yaml`, `mammoth`, rehype-sanitize (already present), vitest.

**Spec:** `docs/superpowers/specs/2026-09-30-folder-links-file-viewers-design.md`

## Global Constraints

- Windows 10/11, WebView2; the browser build (`platform/mock.ts`) must keep working for screenshots.
- Kinds: `text` (default, also Markdown handled by `language`), `table` (csv, tsv), `sheet` (xlsx, xls, ods), `tree` (json, yaml, yml, xml), `code` (toml, log, ini, cfg, conf), `html` (html, htm), `image` (png, jpg, jpeg, gif, webp, svg, bmp, ico), `pdf` (pdf), `docx` (docx).
- Binary kinds: `sheet`, `image`, `pdf`, `docx` — read-only, never autosaved, no recovery file, session keeps path + view state only.
- Grid cell cap 200,000; files over 50 MB are not previewed ("This file is too large to preview" + Open in default app).
- HTML iframe: `sandbox="allow-same-origin"` only (never `allow-scripts`, `allow-forms`, `allow-popups`).
- Existing `mdView` field keeps its name and values (`visual` = View, `edit` = Source, `split` = both) — no session migration needed.
- UI wording: "View", "Source", "Split"; "Save sheet as CSV…"; "Open in default app"; "Couldn't find <path>"; "Save this note first so relative links have a folder to start from."
- Commit after each task; `npm run typecheck` and `npm test` green before every commit; Rust tests with `cargo test --manifest-path src-tauri/Cargo.toml --lib`.

## Review Focus

1. A link whose target folder name contains spaces or `%20` (e.g. `[Assets](My%20Assets/)`) must open that folder, not report it missing — test in Task 2.
2. A CSV with a quoted field containing the delimiter and a newline must stay one cell — test in Task 7.
3. A binary tab dragged to another window must not carry an empty text buffer that later "saves" over the file — test in Task 5 (binary meta round trip ignores text) and guard in saveDoc.
4. A malformed JSON/YAML/XML file must open (in Source with an error banner), not throw — tests in Task 8.
5. An HTML page with `<script>` or `onload=` must render without running them — covered by the sandbox attribute; test in Task 9 that `prepareHtml` keeps no `<base>` duplication and strips remote sources when blocked.

---

### Task 1: Type badge at the end of tabs, new badge labels

**Files:**
- Modify: `app/src/lib/file-badge.ts`, `app/src/lib/file-badge.test.ts`
- Modify: `app/src/ui/TabStrip.tsx:35-36`, `app/src/ui/Sidebar.tsx:57-65`, `app/src/styles/app.css` (`.side-note` block)

**Interfaces:** Produces `fileBadge(d: { language: 'plain' | 'markdown'; path: string | null }): { label: string; kind: 'txt' | 'md' | 'other' }` (unchanged signature).

- [ ] **Step 1: Failing tests** — append to `file-badge.test.ts`:

```ts
  it('images share one IMG badge', () => {
    for (const p of ['a.png', 'b.JPG', 'c.jpeg', 'd.gif', 'e.webp', 'f.svg', 'g.bmp', 'h.ico'])
      expect(fileBadge({ language: 'plain', path: p })).toEqual({ label: 'IMG', kind: 'other' });
  });
  it('yml reads YAML, htm reads HTML', () => {
    expect(fileBadge({ language: 'plain', path: 'x.yml' }).label).toBe('YAML');
    expect(fileBadge({ language: 'plain', path: 'x.htm' }).label).toBe('HTML');
  });
  it('document types keep their name', () => {
    for (const [p, l] of [['a.xlsx', 'XLSX'], ['a.csv', 'CSV'], ['a.json', 'JSON'], ['a.docx', 'DOCX'], ['a.pdf', 'PDF'], ['a.ods', 'ODS']])
      expect(fileBadge({ language: 'plain', path: p }).label).toBe(l);
  });
```

- [ ] **Step 2:** `npx vitest run src/lib/file-badge.test.ts` → FAIL (PNG, YML, HTM).
- [ ] **Step 3: Implement** in `file-badge.ts`:

```ts
const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']);
const ALIAS: Record<string, string> = { yml: 'YAML', htm: 'HTML', jpeg: 'IMG' };

export function fileBadge(d: { language: 'plain' | 'markdown'; path: string | null }): { label: string; kind: BadgeKind } {
  if (d.language === 'markdown') return { label: 'MD', kind: 'md' };
  const ext = d.path && /\.([^.\\/]+)$/.exec(d.path)?.[1]?.toLowerCase();
  if (!ext || ext === 'txt') return { label: 'TXT', kind: 'txt' };
  if (IMAGE.has(ext)) return { label: 'IMG', kind: 'other' };
  return { label: ALIAS[ext] ?? ext.slice(0, 4).toUpperCase(), kind: 'other' };
}
```

- [ ] **Step 4: Move the badge.** TabStrip: render `<span class="tab-title">` (or InlineRename) first, then `<span class="type-badge …">`, then the close button. Sidebar: order becomes `side-note-text`, badge, close button; CSS: `.side-note { padding-left: 10px }` and `.side-note > .type-badge { align-self: flex-start; margin-top: 3px; }` so it sits on the title line.
- [ ] **Step 5:** `npm run typecheck && npm test` → PASS. Commit `feat: type badge at the end of tabs; IMG/YAML/HTML badge labels`.

### Task 2: `resolveLinkTarget` and `relativeLink` (pure)

**Files:**
- Create: `app/src/lib/link-target.ts`, `app/src/lib/link-target.test.ts`

**Interfaces:** Produces

```ts
export type LinkTarget =
  | { kind: 'anchor'; id: string }
  | { kind: 'web'; url: string }
  | { kind: 'path'; path: string }
  | { kind: 'needs-save' }
  | { kind: 'none' };
export function resolveLinkTarget(href: string, docPath: string | null): LinkTarget;
/** The href to write for `target` from a document at docPath (relative with / when possible). */
export function relativeLink(target: string, docPath: string | null): string;
```

- [ ] **Step 1: Failing tests** (`link-target.test.ts`):

```ts
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
  it('a literal % that is not an escape survives', () => expect(r('100%25 done.md', doc)).toEqual({ kind: 'path', path: 'C:\\Proj\\docs\\100% done.md' }));
});
describe('relativeLink', () => {
  it('same folder', () => expect(relativeLink('C:\\Proj\\docs\\ledger.md', doc)).toBe('ledger.md'));
  it('sibling folder, spaces encoded', () => expect(relativeLink('C:\\Proj\\My Assets', doc)).toBe('../My%20Assets/'));
  it('other drive stays absolute', () => expect(relativeLink('D:\\x\\y.csv', doc)).toBe('file:///D:/x/y.csv'));
  it('unsaved doc stays absolute', () => expect(relativeLink('C:\\a b\\c.txt', null)).toBe('file:///C:/a%20b/c.txt'));
});
```

(`relativeLink` appends `/` for folders only when told: signature is `relativeLink(target, docPath, isFolder = false)`; the sibling-folder test passes `true`.) Update that test call to `relativeLink('C:\\Proj\\My Assets', doc, true)`.

- [ ] **Step 2:** run → FAIL (module missing).
- [ ] **Step 3: Implement** `link-target.ts`:

```ts
const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
function normalize(p: string): string {
  const unc = p.startsWith('\\\\') || p.startsWith('//');
  const parts = p.replace(/\//g, '\\').split('\\');
  const out: string[] = [];
  for (const [i, part] of parts.entries()) {
    if (part === '..') { if (out.length > 1) out.pop(); }
    else if (part === '.' || (part === '' && i > 0 && !(unc && i < 2))) continue;
    else out.push(part);
  }
  const s = out.join('\\');
  return unc ? '\\\\' + s.replace(/^\\+/, '') : s;
}
const dirOf = (p: string) => p.slice(0, Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/')));

export function resolveLinkTarget(href: string, docPath: string | null): LinkTarget {
  const h = href.trim();
  if (!h) return { kind: 'none' };
  if (h.startsWith('#')) return { kind: 'anchor', id: safeDecode(h.slice(1)) };
  if (/^(https?:|mailto:)/i.test(h)) return { kind: 'web', url: h };
  const noFrag = h.replace(/#.*$/, '');
  if (/^file:/i.test(noFrag)) return { kind: 'path', path: normalize(safeDecode(noFrag.replace(/^file:\/*/i, ''))) };
  const dec = safeDecode(noFrag);
  if (/^[a-zA-Z]:[\\/]/.test(dec) || /^(\\\\|\/\/)/.test(dec)) return { kind: 'path', path: normalize(dec) };
  if (!docPath) return { kind: 'needs-save' };
  return { kind: 'path', path: normalize(dirOf(docPath) + '\\' + dec) };
}

const enc = (seg: string) => encodeURIComponent(seg).replace(/%2F/g, '/');
export function relativeLink(target: string, docPath: string | null, isFolder = false): string {
  const t = normalize(target);
  const tail = isFolder ? '/' : '';
  const fileUrl = () => 'file:///' + t.split('\\').map(enc).join('/').replace(/^([A-Za-z])%3A/, '$1:') + tail;
  if (!docPath) return fileUrl();
  const from = normalize(dirOf(docPath)).split('\\');
  const to = t.split('\\');
  if (from[0].toLowerCase() !== to[0].toLowerCase()) return fileUrl();
  let i = 0;
  while (i < from.length && i < to.length && from[i].toLowerCase() === to[i].toLowerCase()) i++;
  const up = from.slice(i).map(() => '..');
  return [...up, ...to.slice(i).map(enc)].join('/') + tail;
}
```

- [ ] **Step 4:** run → PASS; commit `feat: resolve link targets (relative, drive, file URL, UNC) and build relative links`.

### Task 3: Rust `path_kind`, `open_folder`, `open_default`; platform wiring

**Files:**
- Modify: `app/src-tauri/src/files.rs` (add `path_kind` + test), `app/src-tauri/src/integration.rs` (add `open_folder` on both cfg branches), `app/src-tauri/src/lib.rs` (commands + handler list)
- Modify: `app/src/platform/types.ts`, `tauri.ts`, `mock.ts`

**Interfaces:** Produces platform methods:

```ts
pathKind(path: string): Promise<'file' | 'dir' | 'missing'>;
openFolder(path: string): Promise<void>;
openDefault(path: string): Promise<void>; // the file in its default Windows app
pickPath(kind: 'file' | 'folder'): Promise<string | null>;
```

- [ ] **Step 1: Failing Rust test** in `files.rs` tests module:

```rust
#[test]
fn path_kind_tells_files_folders_and_missing() {
    let dir = std::env::temp_dir().join(format!("np2-pk-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let f = dir.join("a.txt");
    std::fs::write(&f, "x").unwrap();
    assert_eq!(path_kind(&dir), "dir");
    assert_eq!(path_kind(&f), "file");
    assert_eq!(path_kind(&dir.join("nope")), "missing");
    std::fs::remove_dir_all(&dir).unwrap();
}
```

- [ ] **Step 2:** `cargo test --manifest-path src-tauri/Cargo.toml --lib path_kind` → FAIL.
- [ ] **Step 3: Implement**

```rust
/// "file", "dir" or "missing" (links decide whether to open a tab or File Explorer).
pub fn path_kind(path: &Path) -> &'static str {
    match std::fs::metadata(path) {
        Ok(m) if m.is_dir() => "dir",
        Ok(_) => "file",
        Err(_) => "missing",
    }
}
```

integration.rs (windows): `pub fn open_folder(path: &str) -> Result<(), String> { Command::new("explorer.exe").arg(path).spawn().map(|_| ()).map_err(|e| e.to_string()) }`; non-windows stub returns `Err(NO.into())`. lib.rs commands:

```rust
#[tauri::command]
fn path_kind(path: String) -> &'static str { files::path_kind(std::path::Path::new(&path)) }
#[tauri::command]
fn open_folder(path: String) -> Result<(), String> { integration::open_folder(&path) }
#[tauri::command]
fn open_default(path: String) -> Result<(), String> { integration::shell_open(&path) }
```

Add all three to `generate_handler!`. tauri.ts: `pathKind: (path) => invoke('path_kind', { path })`, `openFolder`, `openDefault`, and `pickPath: async (kind) => { const r = await openDlg({ multiple: false, directory: kind === 'folder' }); return typeof r === 'string' ? r : null; }`. mock.ts: `pathKind` returns `'file'` if the mock fs has the path, `'dir'` if any key starts with `path + '\\'`, else `'missing'`; `openFolder`/`openDefault` no-ops; `pickPath` returns `prompt('Path')`.
- [ ] **Step 4:** cargo test + typecheck + vitest → PASS; commit `feat(rust): path_kind, open_folder, open_default; platform pickPath`.

### Task 4: Following links (Preview, Visual Ctrl+click, HTML viewer later) and Browse… in the link dialog

**Files:**
- Create: `app/src/state/links.ts`
- Modify: `app/src/ui/EditorPane.tsx` (Preview `onClick`; delete local `joinPath`), `app/src/ui/VisualEditor.tsx` (Ctrl+click), `app/src/editor/format.ts` (`askLink`)

**Interfaces:** Consumes `resolveLinkTarget`, `relativeLink` (Task 2), platform methods (Task 3). Produces `followLink(href: string, docPath: string | null, scrollTo?: (id: string) => void): Promise<void>`.

- [ ] **Step 1: Implement `links.ts`**

```ts
import { resolveLinkTarget } from '../lib/link-target';
import { platform } from '../platform';
import { openFiles } from './app';
import { alertMsg, showToast } from './ui';

/** A clicked link: anchors scroll, web links open in the browser, folders in File Explorer, files in a tab. */
export async function followLink(href: string, docPath: string | null, scrollTo?: (id: string) => void) {
  const t = resolveLinkTarget(href, docPath);
  if (t.kind === 'anchor') return scrollTo?.(t.id);
  if (t.kind === 'web') return platform.openExternal(t.url);
  if (t.kind === 'needs-save') return showToast('Save this note first so relative links have a folder to start from.');
  if (t.kind !== 'path') return;
  const k = await platform.pathKind(t.path).catch(() => 'missing' as const);
  if (k === 'dir') return platform.openFolder(t.path).catch((e) => alertMsg('Notepad 2.0', String(e)));
  if (k === 'file') return void openFiles([t.path]);
  await alertMsg('Notepad 2.0', `Couldn't find ${t.path}`);
}
```

- [ ] **Step 2:** Preview `onClick` becomes: `const a = closest('a'); if (!a) return; e.preventDefault(); void followLink(a.getAttribute('href') ?? '', d?.path ?? null, (id) => ref.current?.querySelector(`[id="${CSS.escape('user-content-' + id)}"], [id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'start' }));`
- [ ] **Step 3:** VisualEditor: add a `click` listener on `ed.view.dom`: if `(e.ctrlKey || e.metaKey)` and target is inside `a[href]`, `preventDefault()` and `followLink(href, activeDoc.value?.path ?? null)`. Add `title="Ctrl+click to follow"` via CSS `cursor: pointer` on `.visual-editor a` while Ctrl is held is not needed (YAGNI).
- [ ] **Step 4:** `askLink(current)` gains Browse buttons:

```ts
async function askLink(current: string): Promise<string | null> {
  for (let value = current; ; ) {
    const r = await ask({
      title: 'Link',
      buttons: [
        { label: 'OK', value: 'ok', primary: true },
        { label: 'File…', value: 'file' },
        { label: 'Folder…', value: 'folder' },
        { label: 'Cancel', value: 'cancel' },
      ],
      input: { value, label: 'Address, file or folder (leave empty to remove the link)', select: true },
    });
    if (r.value !== 'file' && r.value !== 'folder') return r.value === 'ok' ? (r.input ?? '').trim() : null;
    const picked = await platform.pickPath(r.value);
    value = picked ? relativeLink(picked, activeDoc.value?.path ?? null, r.value === 'folder') : r.input ?? value;
  }
}
```

- [ ] **Step 5:** typecheck + tests; manual: in the browser build a `[x](../)` link calls `pathKind`. Commit `feat: links to folders open File Explorer; Ctrl+click links in Visual; Browse in the link dialog`.

### Task 5: View kinds on documents, binary tabs, per-kind syntax highlighting

**Files:**
- Create: `app/src/lib/view-kind.ts`, `app/src/lib/view-kind.test.ts`, `app/src/editor/log-lang.ts`, `app/src/editor/log-lang.test.ts`
- Modify: `app/src/state/app.ts` (DocMeta, addDoc, openFiles, reloadDoc, restoreSession, saveSession entry, saveDoc/saveDocAs/closeDoc/onEdited guards, checkExternalChanges, snapshot/import), `app/src/editor/setup.ts` (`cSyntax` compartment + `createEditorState(..., syntax?)`)

**Interfaces:** Produces

```ts
export type ViewerKind = 'text' | 'table' | 'sheet' | 'tree' | 'code' | 'html' | 'image' | 'pdf' | 'docx';
export function viewKindFor(path: string | null): ViewerKind;
export function isBinaryKind(k: ViewerKind | undefined): boolean; // sheet|image|pdf|docx
export function hasViewPane(k: ViewerKind | undefined): boolean;  // table|tree|html
export const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;
// DocMeta gains: viewer?: ViewerKind; size?: number; rev?: number (bumped when a binary file changes on disk)
// setup.ts: createEditorState(text, isMarkdown, readOnly, cfg, syntax?: Extension)
// app.ts: export function sessionDoc(d: DocMeta): DocMeta  (what the session stores for a doc)
export function logHighlighter(): Extension; // editor/log-lang.ts
export function logLineClass(line: string): 'error' | 'warn' | 'info' | 'debug' | null;
```

- [ ] **Step 1: Failing tests**

```ts
// view-kind.test.ts
import { describe, it, expect } from 'vitest';
import { viewKindFor, isBinaryKind, hasViewPane } from './view-kind';
describe('viewKindFor', () => {
  const cases: [string, string][] = [
    ['a.csv', 'table'], ['a.TSV', 'table'], ['a.xlsx', 'sheet'], ['a.xls', 'sheet'], ['a.ods', 'sheet'],
    ['a.json', 'tree'], ['a.yaml', 'tree'], ['a.yml', 'tree'], ['a.xml', 'tree'], ['a.toml', 'code'], ['a.log', 'code'],
    ['a.ini', 'code'], ['a.cfg', 'code'], ['a.conf', 'code'], ['a.html', 'html'], ['a.htm', 'html'], ['a.png', 'image'],
    ['a.JPEG', 'image'], ['a.svg', 'image'], ['a.ico', 'image'], ['a.pdf', 'pdf'], ['a.docx', 'docx'], ['a.txt', 'text'],
    ['a.md', 'text'], ['README', 'text'], ['C:\\my.dir\\file', 'text'],
  ];
  for (const [p, k] of cases) it(p, () => expect(viewKindFor(p)).toBe(k));
  it('untitled is text', () => expect(viewKindFor(null)).toBe('text'));
  it('binary and view-pane kinds', () => {
    expect(['sheet', 'image', 'pdf', 'docx'].every((k) => isBinaryKind(k as any))).toBe(true);
    expect(isBinaryKind('table')).toBe(false);
    expect(['table', 'tree', 'html'].every((k) => hasViewPane(k as any))).toBe(true);
    expect(hasViewPane('code')).toBe(false);
  });
});
// log-lang.test.ts
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
```

Also in a new `app/src/state/session-doc.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sessionDoc } from './app';
describe('sessionDoc', () => {
  it('binary tabs keep only path and view state', () => {
    const d: any = { id: 'f1', kind: 'file', path: 'C:\\a.xlsx', title: 'a.xlsx', viewer: 'sheet', dirty: true, banner: { kind: 'error', text: 'x' }, encoding: 'utf-8', bom: false, eol: 'crlf', language: 'plain', mdView: 'visual', mtime: 5, readonly: true, created: 1, modified: 2 };
    const s = sessionDoc(d);
    expect(s.dirty).toBe(false);
    expect(s.banner).toBe(null);
    expect(s.viewer).toBe('sheet');
  });
  it('keeps the restored banner for text files', () => {
    const d: any = { id: 'f2', kind: 'file', path: 'C:\\a.txt', banner: { kind: 'restored', text: 'r' }, dirty: true };
    expect(sessionDoc(d).banner).toEqual({ kind: 'restored', text: 'r' });
  });
});
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement `view-kind.ts`**

```ts
export type ViewerKind = 'text' | 'table' | 'sheet' | 'tree' | 'code' | 'html' | 'image' | 'pdf' | 'docx';
const BY_EXT: Record<string, ViewerKind> = {
  csv: 'table', tsv: 'table', xlsx: 'sheet', xls: 'sheet', ods: 'sheet', json: 'tree', yaml: 'tree', yml: 'tree',
  xml: 'tree', toml: 'code', log: 'code', ini: 'code', cfg: 'code', conf: 'code', html: 'html', htm: 'html',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', ico: 'image',
  pdf: 'pdf', docx: 'docx',
};
export const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;
export function viewKindFor(path: string | null): ViewerKind {
  const ext = path && /\.([^.\\/]+)$/.exec(path)?.[1]?.toLowerCase();
  return (ext && BY_EXT[ext]) || 'text';
}
export const isBinaryKind = (k?: ViewerKind) => k === 'sheet' || k === 'image' || k === 'pdf' || k === 'docx';
export const hasViewPane = (k?: ViewerKind) => k === 'table' || k === 'tree' || k === 'html';
```

`log-lang.ts`: `logLineClass` with `/\b(ERROR|FATAL|CRITICAL|SEVERE)\b/i` → error, `/\b(WARN|WARNING)\b/i` → warn, `/\bINFO\b/i` → info, `/\b(DEBUG|TRACE|VERBOSE)\b/i` → debug; case-insensitive but whole-word so `errors=0` doesn't match. `logHighlighter()` is a `ViewPlugin` that decorates each visible line with `Decoration.line({ class: 'log-' + cls })` and dims a leading timestamp (`/^\s*\[?\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?[^\]\s]*\]?/` → `Decoration.mark({ class: 'log-time' })`). CSS in app.css: `.log-error{color:var(--syn-error, #e5484d)} .log-warn{color:#d4a72c} .log-debug,.log-info{color:var(--text-2)} .log-time{color:var(--text-3)}`.

- [ ] **Step 4: Syntax per kind.** setup.ts: `export const cSyntax = new Compartment();`, add `cSyntax.of(syntax ?? [])` to the extensions and the optional `syntax?: Extension` parameter; `reconfigureEffects` leaves `cSyntax` alone. app.ts: `const syntaxes = new Map<string, Extension>()`, and `async function syntaxFor(path: string, viewer: ViewerKind): Promise<Extension>`: for `code` log files → `logHighlighter()`; otherwise `LanguageDescription.matchFilename(languages, basename(path))?.load()` wrapped with `syntaxHighlighting(mdHighlight)` — export `codeHighlight = syntaxHighlighting(mdHighlight)` from setup.ts for reuse; returns `[]` when no match. `addDoc(d, text, syntax?)` stores it and passes it to `createEditorState`; `reloadDoc` reuses `syntaxes.get(id)`.
- [ ] **Step 5: openFiles for viewers.** After the `elsewhere` check:

```ts
const viewer = viewKindFor(path);
if (isBinaryKind(viewer)) {
  const st = await platform.stat(path);
  if (!st.exists) throw new Error('The system cannot find the file specified.');
  const id = uid('file'); const now = Date.now();
  addDoc({ id, kind: 'file', path, title: basename(path), encoding: 'utf-8', bom: false, eol: 'crlf', language: 'plain',
    mdView: 'visual', dirty: false, mtime: st.mtime, readonly: true, created: now, modified: st.mtime, viewer, size: st.size, banner: null }, '');
  /* place + addRecent + last = id exactly as for text files */
  continue;
}
```

For text files keep the existing branch, add `viewer: viewer === 'text' ? undefined : viewer`, `mdView: hasViewPane(viewer) ? 'visual' : existing rule`, and pass `await syntaxFor(path, viewer)` when `viewer !== 'text'`. Files over `MAX_PREVIEW_BYTES` (from `stat`) open as a binary tab with `viewer` kept and a `banner: { kind: 'error', text: 'This file is too large to preview.' }` and `size` set; the ViewerPane shows the notice (Task 10).
- [ ] **Step 6: Guards.** `onEdited`: return early for `isBinaryKind(d.viewer)`. `saveDoc` / `saveDocAs`: if `isBinaryKind(d.viewer)` → `showToast('This file is shown read-only.')` and return false. `closeDoc`: skip prompt for binary. `flushAll`: unchanged (no timers). `export function sessionDoc(d)`: `isBinaryKind(d.viewer) ? { ...d, dirty: false, banner: null } : { ...d, banner: d.banner?.kind === 'restored' ? d.banner : null }`, used by `saveSession`. `restoreSession`: for binary metas, `stat` the path; if it exists `addDoc({ ...meta, dirty: false, mtime: st.mtime, size: st.size, banner: null }, '')`, else drop it. For non-binary metas with a `viewer`, pass `await syntaxFor(meta.path!, meta.viewer)`. `checkExternalChanges`: for binary docs with a newer mtime, `patchDoc(id, { mtime: st.mtime, size: st.size, rev: (d.rev ?? 0) + 1 })` (silent reload). `importDocs`: for a non-text viewer with a path, recompute syntax asynchronously: `if (meta.viewer && !isBinaryKind(meta.viewer)) syntaxFor(meta.path!, meta.viewer).then((s) => { syntaxes.set(meta.id, s); if (activeId.value === meta.id) view?.dispatch({ effects: cSyntax.reconfigure(s) }); })`.
- [ ] **Step 7:** typecheck + tests → PASS; commit `feat: view kinds on tabs, binary read-only tabs, highlighting for JSON/YAML/XML/HTML/TOML/INI/logs`.

### Task 6: View/Source/Split switch for every kind, toolbar and status bar follow the kind

**Files:**
- Create: `app/src/ui/ViewerPane.tsx`
- Modify: `app/src/ui/MenuBar.tsx` (seg + View menu), `app/src/state/app.ts` (`setMdView`, `cycleMdView`, `inVisual`), `app/src/ui/FormatBar.tsx`, `app/src/ui/StatusBar.tsx`, `app/src/ui/EditorPane.tsx`

**Interfaces:** Consumes `hasViewPane`, `isBinaryKind`. Produces `<ViewerPane doc={DocMeta} />` which lazy-imports `./viewers/<Kind>Viewer` (Tasks 7–12) and shows "Loading…" meanwhile.

- [ ] **Step 1:** `setMdView(id, v)`: only switch `language` to markdown when `!d.viewer`. `cycleMdView`: for `hasViewPane(d.viewer)` cycle visual→edit→split without touching language; for other non-text viewers do nothing. `inVisual()`: add `&& !d.viewer`.
- [ ] **Step 2:** MenuBar seg: shown when `d.language === 'markdown' && !d.viewer` (labels Visual/Source/Split) **or** `hasViewPane(d.viewer)` (labels View/Source/Split, `aria-label="View"`). The View → Markdown submenu is disabled when `d.viewer` is set.
- [ ] **Step 3:** FormatBar returns `null` when `d?.viewer` is set (`code` included — no formatting for data files). StatusBar: when `isBinaryKind(d.viewer)` render `sb-item` with the badge label and `formatBytes(d.size)` instead of Ln/Col, characters, EOL, encoding and the language button. Add `export function formatBytes(n?: number): string` to `lib/view-kind.ts` with test: `formatBytes(0)` → `'0 bytes'`, `1536` → `'1.5 KB'`, `5*1024*1024` → `'5.0 MB'`.
- [ ] **Step 4:** EditorPane: `const kind = d?.viewer;` When `isBinaryKind(kind)`: hide the CodeMirror host and render `<ViewerPane doc={d} />`. When `hasViewPane(kind)`: `view` (mdView) `visual` → only `<ViewerPane>`; `edit` → only CodeMirror; `split` → CodeMirror + divider + `<ViewerPane>`. Markdown behaviour unchanged. `ViewerPane` receives the text via `textOf(d.id)` re-read on `editTick` with a 300 ms debounce for `table`/`tree`/`html`.
- [ ] **Step 5:** typecheck + tests; commit `feat: View/Source/Split for data files; toolbar and status bar follow the file kind`.

### Task 7: Grid, CSV/TSV parser, table viewer

**Files:**
- Create: `app/src/lib/csv.ts`, `app/src/lib/csv.test.ts`, `app/src/lib/grid-sort.ts`, `app/src/lib/grid-sort.test.ts`, `app/src/ui/viewers/Grid.tsx`, `app/src/ui/viewers/TableViewer.tsx`
- Modify: `app/src/styles/app.css` (grid styles)

**Interfaces:** Produces

```ts
export function detectDelimiter(text: string, path: string | null): ',' | ';' | '\t';
export function parseCsv(text: string, delim: string, maxCells?: number): { rows: string[][]; truncated: boolean };
export function toCsv(rows: string[][]): string; // RFC 4180, CRLF line ends
export type SortState = { col: number; dir: 'asc' | 'desc' } | null;
export function sortRows(rows: string[][], s: SortState): string[][]; // header row NOT included
export function nextSort(s: SortState, col: number): SortState;      // asc -> desc -> null
// Grid.tsx
export function Grid(props: { rows: string[][]; truncated?: boolean; header?: boolean }): JSX.Element;
```

- [ ] **Step 1: Failing tests**

```ts
// csv.test.ts
import { describe, it, expect } from 'vitest';
import { parseCsv, detectDelimiter, toCsv } from './csv';
describe('parseCsv', () => {
  it('quotes, doubled quotes, embedded delimiter and newline', () =>
    expect(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\r\n', ',').rows).toEqual([['a', 'b'], ['x, y', 'say "hi"\nthere']]));
  it('ragged rows are padded to the widest row', () => expect(parseCsv('a,b,c\n1\n', ',').rows).toEqual([['a', 'b', 'c'], ['1', '', '']]));
  it('no trailing empty row; BOM stripped', () => expect(parseCsv('\uFEFFa\nb', ',').rows).toEqual([['a'], ['b']]));
  it('cell cap', () => {
    const r = parseCsv('a,b\n1,2\n3,4\n', ',', 4);
    expect(r.rows).toEqual([['a', 'b'], ['1', '2']]);
    expect(r.truncated).toBe(true);
  });
});
describe('detectDelimiter', () => {
  it('tsv by extension', () => expect(detectDelimiter('a,b', 'x.tsv')).toBe('\t'));
  it('semicolon when more consistent', () => expect(detectDelimiter('a;b;c\n1;2,5;3\n4;5;6', 'x.csv')).toBe(';'));
  it('comma default', () => expect(detectDelimiter('a,b\n1,2', 'x.csv')).toBe(','));
  it('tab in a .csv', () => expect(detectDelimiter('a\tb\n1\t2', 'x.csv')).toBe('\t'));
});
describe('toCsv', () => {
  it('quotes only when needed', () => expect(toCsv([['a', 'b,c'], ['say "hi"', 'x\ny']])).toBe('a,"b,c"\r\n"say ""hi""","x\ny"\r\n'));
});
// grid-sort.test.ts
import { describe, it, expect } from 'vitest';
import { sortRows, nextSort } from './grid-sort';
const rows = [['b', '10'], ['a', '9'], ['c', '']];
describe('sortRows', () => {
  it('numbers sort numerically, blanks last', () => expect(sortRows(rows, { col: 1, dir: 'asc' }).map((r) => r[0])).toEqual(['a', 'b', 'c']));
  it('text descending', () => expect(sortRows(rows, { col: 0, dir: 'desc' }).map((r) => r[0])).toEqual(['c', 'b', 'a']));
  it('null keeps file order', () => expect(sortRows(rows, null)).toBe(rows));
  it('cycle', () => {
    expect(nextSort(null, 2)).toEqual({ col: 2, dir: 'asc' });
    expect(nextSort({ col: 2, dir: 'asc' }, 2)).toEqual({ col: 2, dir: 'desc' });
    expect(nextSort({ col: 2, dir: 'desc' }, 2)).toBe(null);
    expect(nextSort({ col: 1, dir: 'desc' }, 2)).toEqual({ col: 2, dir: 'asc' });
  });
});
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement `csv.ts`** — a single-pass state machine over characters (fields, `inQuotes`, `""` escape, `\r\n`/`\n` row ends), stop adding rows once `cells >= maxCells` (default 200000) and set `truncated`; pad rows to the max width; drop one trailing empty row. `detectDelimiter`: `.tsv` → tab; else for each candidate `[',', ';', '\t']` count per-line occurrences outside quotes over the first 20 non-empty lines and pick the candidate with the highest minimum count (>0), tie → the one with the lowest variance, default `,`. `toCsv`: quote a field when it contains `,`, `"`, `\r` or `\n`; double quotes; rows joined with `\r\n` plus a final `\r\n`. `grid-sort.ts`: numeric when both values parse with `Number(v.replace(/[, ]/g, ''))` and are non-empty; blanks always last; `localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })` for text; stable (sort indices).
- [ ] **Step 4: `Grid.tsx`** — a `<div class="grid-wrap">` scroll container with a `<table class="grid">`: `<thead>` from row 0 when `header` (default true) with `position: sticky; top: 0`, a sticky first column of row numbers, click on a header cell → `nextSort`, arrow ▲/▼ on the sorted header. Rows rendered through a simple window: render only rows within `scrollTop / 28 ± 60` using top/bottom spacer rows (`height = n * 28px`), so 200,000 cells stay fast. A `grid-note` line under the table when `truncated`: "Showing the first 200,000 cells." Styles: `.grid td, .grid th { padding: 4px 10px; border: 1px solid var(--border); white-space: pre; max-width: 420px; overflow: hidden; text-overflow: ellipsis; }` and header background `var(--bg-2)`.
- [ ] **Step 5: `TableViewer.tsx`** — `({ doc, text }) => { const delim = detectDelimiter(text, doc.path); const { rows, truncated } = parseCsv(text, delim); return <Grid rows={rows} truncated={truncated} />; }` with `useMemo` on `text`.
- [ ] **Step 6:** typecheck + tests; commit `feat: CSV/TSV grid viewer with sorting and a sticky header`.

### Task 8: Tree viewer for JSON, YAML, XML

**Files:**
- Create: `app/src/lib/tree-model.ts`, `app/src/lib/tree-model.test.ts`, `app/src/ui/viewers/TreeViewer.tsx`
- Modify: `app/package.json` (add `yaml`), `app/src/styles/app.css`

**Interfaces:** Produces

```ts
export type TNode =
  | { t: 'obj'; key?: string; children: TNode[] }
  | { t: 'arr'; key?: string; children: TNode[] }
  | { t: 'val'; key?: string; value: string; vt: 'string' | 'number' | 'bool' | 'null' }
  | { t: 'el'; key?: string; name: string; attrs: [string, string][]; children: TNode[] }
  | { t: 'text'; value: string };
export type TreeResult = { ok: true; root: TNode } | { ok: false; message: string; line: number | null };
export function jsonTree(text: string): TreeResult;
export function yamlTree(text: string): TreeResult;
export function xmlTree(text: string, parse?: (s: string) => Document): TreeResult; // DOMParser injected for tests
export function treeFor(path: string | null, text: string): TreeResult;
```

- [ ] **Step 1: Failing tests** (`tree-model.test.ts`, runs under happy-dom: add `// @vitest-environment happy-dom` at the top):

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { jsonTree, yamlTree, xmlTree, treeFor } from './tree-model';
describe('jsonTree', () => {
  it('objects, arrays, value types', () => {
    const r = jsonTree('{"a":1,"b":[true,null,"x"]}');
    expect(r).toEqual({ ok: true, root: { t: 'obj', children: [
      { t: 'val', key: 'a', value: '1', vt: 'number' },
      { t: 'arr', key: 'b', children: [
        { t: 'val', key: '0', value: 'true', vt: 'bool' }, { t: 'val', key: '1', value: 'null', vt: 'null' }, { t: 'val', key: '2', value: 'x', vt: 'string' },
      ] },
    ] } });
  });
  it('error line', () => {
    const r = jsonTree('{\n  "a": 1,\n  oops\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.line).toBe(3);
  });
});
describe('yamlTree', () => {
  it('maps and lists', () => {
    const r = yamlTree('name: Kai\ntags:\n  - a\n  - 2\n');
    expect(r.ok && r.root.t === 'obj' && r.root.children.map((c) => c.key)).toEqual(['name', 'tags']);
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
    }
  });
  it('malformed', () => expect(xmlTree('<a><b></a>').ok).toBe(false));
});
it('treeFor picks by extension', () => expect(treeFor('x.yml', 'a: 1').ok).toBe(true));
```

- [ ] **Step 2:** `npm i yaml` then run → FAIL.
- [ ] **Step 3: Implement.** `jsonTree`: `JSON.parse` then convert; on error read the position from the message (`/position (\d+)/` or `/line (\d+)/`) and convert position → line by counting `\n`. `yamlTree`: `import { parseDocument } from 'yaml'`; `doc.errors[0]` → `{ ok: false, message: err.message, line: err.linePos?.[0]?.line ?? null }`; else convert `doc.toJS({ maxAliasCount: 100 })` with the JSON converter. `xmlTree`: `(parse ?? ((s) => new DOMParser().parseFromString(s, 'application/xml')))(text)`; a `parsererror` element → `{ ok: false, message: its textContent.trim().split('\n')[0], line: /line (\d+)/i match or null }`; convert elements (attributes in order), non-whitespace text nodes → `{ t: 'text' }`, skip comments.
- [ ] **Step 4: `TreeViewer.tsx`** — renders nodes recursively as `<div class="tv-row" style="--d:depth">` with a chevron button for containers, key in `var(--syn-fn)`, values coloured by `vt` (`string` → `--syn-string` quoted, `number`/`bool`/`null` → `--syn-number`), counts `{n}` / `[n]` / `<name attr="v">` for elements. Expanded state in a `Set<string>` of node paths; default: depth < 2. Toolbar row with "Expand all" / "Collapse all". On `!ok`: a `banner banner-error` inside the pane: "Couldn't read this file: <message> (line N). Showing Source." and the pane calls `setMdView(doc.id, 'edit')` once (guarded by a ref so the user can switch back).
- [ ] **Step 5:** typecheck + tests; commit `feat: JSON/YAML/XML tree viewer`.

### Task 9: HTML viewer

**Files:**
- Create: `app/src/lib/html-doc.ts`, `app/src/lib/html-doc.test.ts`, `app/src/ui/viewers/HtmlViewer.tsx`

**Interfaces:** Produces `prepareHtml(html: string, baseHref: string | null, blockRemote: boolean): string`. Consumes `followLink` (Task 4).

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { prepareHtml } from './html-doc';
describe('prepareHtml', () => {
  it('adds a base into head', () => expect(prepareHtml('<html><head><title>t</title></head><body>x</body></html>', 'http://asset.localhost/C%3A/p/', false))
    .toContain('<head><base href="http://asset.localhost/C%3A/p/"><title>'));
  it('adds head when missing', () => expect(prepareHtml('<p>x</p>', 'B/', false)).toMatch(/^<head><base href="B\/"><\/head><p>x<\/p>$/));
  it('does not add a second base', () => expect(prepareHtml('<head><base href="https://x/"></head>', 'B/', false).match(/<base/g)!.length).toBe(1));
  it('strips remote images and css urls when blocked', () => {
    const out = prepareHtml('<img src="https://t.co/a.png"><div style="background:url(http://x/y.png)"></div><img src="a.png">', null, true);
    expect(out).not.toContain('https://t.co');
    expect(out).not.toContain('http://x/');
    expect(out).toContain('src="a.png"');
  });
});
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** with string operations (no DOM needed): if `baseHref` and no `/<base\s/i`, insert `<base href="…">` right after `<head…>` or prepend `<head><base …></head>`. When `blockRemote`: replace `(src|srcset)="https?:[^"]*"` with `$1=""` and `url\(\s*['"]?https?:[^)]*\)` with `none`.
- [ ] **Step 4: `HtmlViewer.tsx`** — `<iframe class="html-frame" sandbox="allow-same-origin" srcDoc={prepareHtml(text, baseHref, s.blockRemoteImages)} />` where `baseHref = doc.path ? platform.assetUrl(dirname(doc.path) + '\\') : null` (assetUrl encodes the path; ensure a trailing `/`). On `load`, attach a `click` listener to `frame.contentDocument` that finds `closest('a[href]')`, `preventDefault()`, and calls `followLink(a.getAttribute('href'), doc.path)`; for `#anchor` links scroll inside the frame (`contentDocument.getElementById(id)?.scrollIntoView()`). White background for the frame (`background: #fff`) since pages expect it.
- [ ] **Step 5:** tauri.conf.json CSP: add `frame-src 'self' asset: http://asset.localhost blob: data:;` (also used by PDF).
- [ ] **Step 6:** typecheck + tests; commit `feat: HTML viewer (sandboxed, scripts never run, links followed)`.

### Task 10: Image and PDF viewers; too-large and error notices

**Files:**
- Create: `app/src/ui/viewers/ImageViewer.tsx`, `app/src/ui/viewers/PdfViewer.tsx`, `app/src/ui/viewers/Notice.tsx`
- Modify: `app/src/ui/ViewerPane.tsx`, `app/src/styles/app.css`

**Interfaces:** Produces `<Notice text: string; path: string | null />` with an "Open in default app" button (`platform.openDefault`). `ViewerPane` shows `Notice` when `doc.size > MAX_PREVIEW_BYTES`.

- [ ] **Step 1:** `ImageViewer`: `src = platform.assetUrl(doc.path) + '?v=' + (doc.rev ?? 0)`; state `zoom: 'fit' | number`; toolbar buttons Fit / 100% / − / +; Ctrl+wheel changes zoom by ×1.1 (clamped 0.05–16); on `load` record `naturalWidth × naturalHeight` and show "W × H px · <formatBytes(size)>" in the toolbar. Checkerboard background for transparency (`.img-stage { background: repeating-conic-gradient(#8882 0 25%, transparent 0 50%) 0 0/16px 16px }`). On `error`: `<Notice text="Couldn't show this image." />`.
- [ ] **Step 2:** `PdfViewer`: `<iframe class="pdf-frame" src={platform.assetUrl(doc.path) + '#view=FitH'} title={doc.title} />` filling the pane. In the browser build (`platform.kind === 'browser'`) show `Notice` "PDF preview needs the desktop app." instead.
- [ ] **Step 3:** ViewerPane routing: `sheet`/`docx`/`table`/`tree`/`html`/`image`/`pdf` → lazy components; binary + `size > MAX_PREVIEW_BYTES` → `Notice` "This file is too large to preview." Each lazy load wrapped in try/catch → `Notice` with the error text.
- [ ] **Step 4:** typecheck + tests; manual check in the browser build with a sample PNG; commit `feat: image and PDF viewers; too-large notice with Open in default app`.

### Task 11: Spreadsheets (XLSX/XLS/ODS) read in Rust; Save sheet as CSV

**Files:**
- Create: `app/src-tauri/src/sheets.rs`, `app/src/ui/viewers/SheetViewer.tsx`
- Modify: `app/src-tauri/Cargo.toml` (`calamine = "0.31"`, dev-dep `rust_xlsxwriter = "0.90"`), `app/src-tauri/src/lib.rs`, platform types/tauri/mock, `app/src/ui/MenuBar.tsx` (File menu item)

**Interfaces:** Produces Rust `pub fn read_sheet(path: &Path, max_cells: usize) -> Result<Workbook, String>` with

```rust
#[derive(Serialize)] pub struct Sheet { pub name: String, pub rows: Vec<Vec<String>>, pub truncated: bool }
#[derive(Serialize)] pub struct Workbook { pub sheets: Vec<Sheet> }
```

and platform `readSheet(path: string): Promise<{ sheets: { name: string; rows: string[][]; truncated: boolean }[] }>`; `saveSheetCsv(id)` in app.ts.

- [ ] **Step 1: Failing Rust test** in `sheets.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reads_values_dates_formula_results_and_two_sheets() {
        let p = std::env::temp_dir().join(format!("np2-sheet-{}.xlsx", std::process::id()));
        let mut wb = rust_xlsxwriter::Workbook::new();
        let date = rust_xlsxwriter::Format::new().set_num_format("dd/mm/yyyy");
        let s = wb.add_worksheet().set_name("Cast").unwrap();
        s.write_string(0, 0, "Name").unwrap();
        s.write_string(0, 1, "Fee").unwrap();
        s.write_string(1, 0, "Ann").unwrap();
        s.write_number(1, 1, 1250.5).unwrap();
        s.write_formula(2, 1, rust_xlsxwriter::Formula::new("=B2*2").set_result("2501")).unwrap();
        s.write_datetime_with_format(3, 0, &rust_xlsxwriter::ExcelDateTime::from_ymd(2026, 9, 30).unwrap(), &date).unwrap();
        wb.add_worksheet().set_name("Notes").unwrap().write_string(0, 0, "hi").unwrap();
        wb.save(&p).unwrap();
        let w = read_sheet(&p, 1000).unwrap();
        assert_eq!(w.sheets.iter().map(|s| s.name.as_str()).collect::<Vec<_>>(), ["Cast", "Notes"]);
        let r = &w.sheets[0].rows;
        assert_eq!(r[0], ["Name", "Fee"]);
        assert_eq!(r[1], ["Ann", "1250.5"]);
        assert_eq!(r[2][1], "2501");
        assert_eq!(r[3][0], "30/09/2026");
        std::fs::remove_file(&p).ok();
    }
    #[test]
    fn caps_cells() {
        let p = std::env::temp_dir().join(format!("np2-cap-{}.xlsx", std::process::id()));
        let mut wb = rust_xlsxwriter::Workbook::new();
        let s = wb.add_worksheet();
        for r in 0..10 { s.write_number(r, 0, r as f64).unwrap(); s.write_number(r, 1, 1.0).unwrap(); }
        wb.save(&p).unwrap();
        let w = read_sheet(&p, 6).unwrap();
        assert_eq!(w.sheets[0].rows.len(), 3);
        assert!(w.sheets[0].truncated);
        std::fs::remove_file(&p).ok();
    }
    #[test]
    fn not_a_workbook_is_an_error() {
        let p = std::env::temp_dir().join(format!("np2-bad-{}.xlsx", std::process::id()));
        std::fs::write(&p, "not a zip").unwrap();
        assert!(read_sheet(&p, 10).is_err());
        std::fs::remove_file(&p).ok();
    }
}
```

- [ ] **Step 2:** `cargo test --manifest-path src-tauri/Cargo.toml --lib sheets` → FAIL.
- [ ] **Step 3: Implement** with `calamine::{open_workbook_auto, Reader, Data}`: for each sheet name, `worksheet_range`; rows from the range's start (0,0 inclusive: prepend empty rows/cols so row/col indices match Excel from A1); cell → string: `Data::String(s)` s, `Float(f)` → integer-looking floats without `.0`, else `f.to_string()`; `Int(i)`; `Bool(b)` → `TRUE`/`FALSE`; `DateTime(d)` → `d.as_datetime()` formatted `%d/%m/%Y` (plus ` %H:%M` when the time part is non-zero); `DateTimeIso(s)`/`DurationIso(s)` → s; `Error(e)` → `format!("#{e:?}")` mapped to Excel text (`Div0` → `#DIV/0!`, `NA` → `#N/A`, `Value` → `#VALUE!`, `Ref` → `#REF!`, `Name` → `#NAME?`, `Num` → `#NUM!`, `Null` → `#NULL!`, other → `#ERROR`); `Empty` → "". Stop at `max_cells` per sheet (whole rows) and set `truncated`. Errors map to `format!("Couldn't read this workbook: {e}")`. Command `async fn read_sheet(path: String) -> Result<sheets::Workbook, String>` with `max_cells = 200_000`.
- [ ] **Step 4: `SheetViewer.tsx`** — loads `platform.readSheet(doc.path)` (re-runs when `doc.rev` changes), shows `Grid` for the active sheet and a bottom `.sheet-tabs` row of buttons (one per sheet, active highlighted). Errors → `Notice`. Keeps the active sheet index in a module-level `Map<docId, number>` so switching tabs keeps it.
- [ ] **Step 5: Save sheet as CSV.** app.ts `export const sheetExport = { current: null as null | (() => { name: string; rows: string[][] }) }` set by SheetViewer; `export async function saveSheetCsv(id)`: `const s = sheetExport.current?.(); const path = await platform.saveDialog(`${basename(d.path).replace(/\.[^.]+$/, '')} - ${s.name}.csv`, false); await platform.writeFile(path, encodeText(toCsv(s.rows), 'utf-8', true, 'crlf'))` then `showToast('Saved …')` and `openFiles([path])`? No — just the toast. File menu: "Save sheet as CSV…" shown when `d?.viewer === 'sheet'`. Mock: `readSheet` returns a two-sheet fixture from `mock-samples.ts`.
- [ ] **Step 6:** cargo test, typecheck, tests; commit `feat: XLSX/XLS/ODS viewer (calamine), sheet tabs, Save sheet as CSV`.

### Task 12: DOCX viewer

**Files:**
- Create: `app/src/ui/viewers/DocxViewer.tsx`
- Modify: `app/package.json` (add `mammoth`), `app/src/markdown/pipeline.ts` (export `sanitizeHtml`), `app/src/markdown/pipeline.test.ts`

**Interfaces:** Produces `sanitizeHtml(html: string): string` (same schema as the Markdown preview, without data-line).

- [ ] **Step 1: Failing test** (pipeline.test.ts):

```ts
import { sanitizeHtml } from './pipeline';
describe('sanitizeHtml', () => {
  it('keeps structure, drops scripts and handlers', () => {
    const out = sanitizeHtml('<h1 onclick="x()">T</h1><script>alert(1)</script><p><strong>b</strong></p><img src="data:image/png;base64,AAAA">');
    expect(out).toContain('<h1>T</h1>');
    expect(out).toContain('<strong>b</strong>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('onclick');
    expect(out).toContain('data:image/png;base64,AAAA');
  });
});
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** `sanitizeHtml` with `unified().use(rehypeParse, { fragment: true }).use(rehypeSanitize, { ...schema, protocols: { ...schema.protocols, src: [...(defaultSchema.protocols?.src ?? []), 'data'] } }).use(rehypeStringify)` (add `rehype-parse` if not already a dependency — check `package.json`; `npm i rehype-parse`).
- [ ] **Step 4: `DocxViewer.tsx`** — `const bytes = (await platform.readFile(doc.path)).bytes; const mammoth = await import('mammoth'); const r = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });` → `sanitizeHtml(r.value)` into `<div class="markdown-body docx-body">` inside `.md-preview`, with the banner "Shown as formatted text: the Word layout is approximate. Open in Word to edit." and an "Open in Word" button (`platform.openDefault`). Reload on `doc.rev`. Links go through `followLink`.
- [ ] **Step 5:** `npm i mammoth`; typecheck + tests; commit `feat: DOCX viewer (mammoth, sanitised)`.

### Task 13: Open dialog, Open-with registration, browser fixtures

**Files:**
- Modify: `app/src/platform/tauri.ts` (`TEXT_FILTERS` → `OPEN_FILTERS`), `app/src/platform/types.ts` (`FILE_TYPES`), `app/src-tauri/src/integration.rs` (`KNOWN_EXTS`), `app/src/platform/mock-samples.ts` + `mock.ts` (fixtures), `app/src/state/demo.ts` (open the fixtures in a "Files" group)

**Interfaces:** `FILE_TYPES` (TS) and `KNOWN_EXTS` (Rust) become the same list:
`.txt .md .markdown .log .ini .cfg .conf .toml .json .yaml .yml .xml .csv .tsv .html .htm .xlsx .xls .ods .docx .pdf .png .jpg .jpeg .gif .webp .svg .bmp .ico`.

- [ ] **Step 1:** Add a Rust test in integration.rs tests (or files.rs) asserting `KNOWN_EXTS` contains `.xlsx`, `.docx`, `.pdf`, `.png` and every entry passes `valid_ext`. Run → FAIL, then extend the list → PASS.
- [ ] **Step 2:** Open dialog filters: `[{ name: 'All supported files', extensions: [...all without dots] }, { name: 'Text and Markdown', extensions: ['txt','md','markdown','log','ini','cfg'] }, { name: 'Data (CSV, JSON, YAML, XML)', … }, { name: 'Spreadsheets', extensions: ['xlsx','xls','ods'] }, { name: 'Documents (HTML, PDF, Word)', … }, { name: 'Images', … }, { name: 'All files', extensions: ['*'] }]`.
- [ ] **Step 3:** Mock fixtures: `Cast.csv`, `Config.json`, `Pipeline.yaml`, `Feed.xml`, `Settings.toml`, `Page.html`, `Logo.svg` as text in `SAMPLE_FILES`; `mock.readSheet` returns a fixture workbook; `mock.readFile('…\\Brief.docx')` is not needed (DOCX screenshot skipped in the browser build — note in README that DOCX/PDF shots come from the desktop app only if captured). demo.ts adds a "Files" group containing the fixtures.
- [ ] **Step 4:** typecheck + tests + cargo test; commit `feat: open dialog and Open with cover every supported type; browser fixtures`.

### Task 14: Docs, screenshots, installer, merge

**Files:**
- Modify: `app/e2e/readme-shots.mjs` (shots 12–16: CSV grid, sheet, JSON tree, HTML, image), `README.md`, `app/README.md`, `docs/quickstart/quickstart.html` (new page "Open anything"), regenerate `docs/Notepad-2.0-Quickstart.pdf`

- [ ] **Step 1:** Add the shots; run `npx vite --port 5188` + `node e2e/readme-shots.mjs`; inspect each PNG.
- [ ] **Step 2:** README: a "Open anything" section with the kinds table from the spec, the folder-link rule, badge note; shortcut table gains "Ctrl+click: follow a link in Visual". app/README: viewers architecture paragraph. Quickstart HTML: a new page 7 "Open anything" with two screenshots; renumber folios.
- [ ] **Step 3:** `node e2e/quickstart-pdf.mjs`; review pages.
- [ ] **Step 4:** Final: `npm run typecheck`, `npm test`, `cargo test --lib`; fresh reviewer over the branch diff; fix findings; merge `feature/file-viewers` into `main` (`--no-ff`); `npx tauri build`; silent install; push `main` (Kaine asked for the latest on GitHub in the previous round; ask before pushing this round).
