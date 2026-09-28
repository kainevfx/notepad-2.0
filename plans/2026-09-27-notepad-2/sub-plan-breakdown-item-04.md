# Sub-plan 04: Markdown, read and edit without errors (P4)

## Pipeline
`unified` → `remark-parse` (micromark, CommonMark 0.31 compliant) → `remark-gfm` (tables, task lists, strikethrough, autolinks, footnotes) → `remark-frontmatter` → `remark-math` → `remark-rehype` (`allowDangerousHtml`) → `rehype-raw` → `rehype-sanitize` (no scripts, no event handlers) → `rehype-katex` → Shiki highlighter (lazy, VS Code grammars) → Mermaid blocks rendered client side on demand → `rehype-slug` + heading anchors.

Why this and not a hand-rolled or `marked`-style parser: the mock's preview shows `**bold**` inside a heading rendered with literal asterisks. micromark passes the full CommonMark and GFM spec test suites, which is the only honest meaning of "no syntax errors". We vendor the spec tests into our own suite.

## Views (toggle in title bar, `Ctrl+Shift+V`, per tab)
1. **Edit** with Markdown syntax highlighting (CodeMirror `lang-markdown` + nested code-fence languages), headings slightly larger, `**`/`_` markers dimmed.
2. **Split**: editor left, preview right (screenshot 1), draggable divider, scroll sync by source line mapping (`data-line` on block elements).
3. **Preview** only, read mode, links clickable (Ctrl+click in edit mode).

## Editing helpers
- Ctrl+B / Ctrl+I / Ctrl+K (bold, italic, link), auto-continue lists and task items on Enter, Tab / Shift+Tab indents list items, table auto-align on Tab inside a table, paste an image saves it next to the file into `./assets/` and inserts the link (setting).
- Outline pane (headings) optional in the sidebar under the groups.

## Rules that protect files
- The preview never writes back. The source text is the only truth, so opening and saving a `.md` changes nothing you did not type.
- Local images and relative links resolve against the file's folder via Tauri's asset protocol, scoped to that folder.
- Remote images load (setting to block them).
- Files over 5 MB open in Edit mode with preview on demand.

## Plain `.txt`
Markdown mode is off for `.txt` by default; status bar language picker switches it on.
