# Folder links, file viewers, and type badges at the end of tabs

Date: 2026-09-30 · Status: approved design, awaiting spec review

## Why

Kaine keeps Markdown documents (plans, ledgers, character sheets written by Codex) next to the files they refer to: folders of assets, a production workbook (.xlsx), exported CSV / JSON / HTML, images, PDFs and Word documents. Today:

- a Markdown link to a folder fails: the app tries to read the folder as a text file;
- every file opens as text, so a workbook, image or PDF is unreadable and CSV / JSON are raw text;
- the TXT / MD badge sits before the title, taking room from the title text.

Success: every link in a document goes somewhere sensible (a folder opens in File Explorer), each of the listed file types opens in a tab that shows it the way you'd expect to see it, text-based types can still be edited as source, and tab titles show more text.

## Scope

1. **Folder links** open File Explorer at the folder.
2. **File viewers** for CSV, TSV, XLSX, XLS, ODS, JSON, YAML, XML, TOML, LOG, INI, HTML/HTM, images (PNG, JPG/JPEG, GIF, WebP, SVG, BMP, ICO), PDF and DOCX.
3. **Type badge moves to the end of the tab** (after the title, before the close button) in the top tab strip and the sidebar.

Out of scope: editing spreadsheets or DOCX, editing JSON in the tree, making Notepad 2.0 the default app for these types, running scripts in HTML.

## 1. Folder links

Applies to links clicked in the Markdown preview (Split view) and, new, in the Visual editor with Ctrl+click (a plain click keeps placing the cursor, as in Word).

Resolution (a pure function `resolveLinkTarget(href, docPath)`, unit-tested):

| href | Result |
|---|---|
| `#slug` | scroll to heading (as today) |
| `http:`, `https:`, `mailto:` | open in the browser (as today) |
| `file:///C:/x/y`, `C:\x\y`, `C:/x/y`, `\\server\share\x` | absolute local path |
| anything else | relative to the document's folder; `%20` etc. decoded; `#fragment` dropped |
| relative link in an unsaved note | a message: "Save this note first so relative links have a folder to start from." |

Then a new Rust command `path_kind(path) -> "file" | "dir" | "missing"` decides:

- **dir** → File Explorer opens at that folder (a new command `open_folder`, `explorer.exe <path>`); a trailing slash in the link is allowed.
- **file** → opens in a tab (as today; now through the viewers below).
- **missing** → message: "Couldn't find <path>".

Insert → Link gets a **Browse…** button with two choices, File… and Folder…, which fill in a path relative to the document when it is saved (absolute otherwise).

## 2. File viewers

### View kinds

A tab gets a `view` kind from its extension when opened (pure function `viewKindFor(path)`, unit-tested). Unknown extensions stay `text` (plain text, as today); `.md` stays `markdown`.

| Kind | Extensions | View | Source | Toolbar switch |
|---|---|---|---|---|
| `table` | csv, tsv | Grid | editable text | View / Source / Split |
| `sheet` | xlsx, xls, ods | Grid with sheet tabs | none (read-only) | none |
| `tree` | json, yaml, yml, xml | Collapsible tree | editable text, highlighted | View / Source / Split |
| `code` | toml, log, ini, cfg, conf | none | editable, highlighted | none |
| `html` | html, htm | Rendered page | editable text, highlighted | View / Source / Split |
| `image` | png, jpg, jpeg, gif, webp, svg, bmp, ico | Image | none | none |
| `pdf` | pdf | PDF viewer | none | none |
| `docx` | docx | Formatted document | none | none |

The Visual / Source / Split switch in the menu bar is generalised: for Markdown it keeps its three labels; for `table`, `tree` and `html` the first button reads **View**. The chosen view is stored per tab (the existing `mdView` field, renamed `view` in memory with the old name still read from saved sessions).

The formatting toolbar is hidden for every kind except `markdown` and `text`. The paper and page-margin settings apply to Source views only.

### Viewers

- **table (CSV/TSV).** Parsed with a small in-house RFC 4180 parser (quotes, doubled quotes, embedded newlines, CRLF/LF). Delimiter: `,` for .csv unless the first 20 lines are more consistent with `;` or tab; always tab for .tsv. First row is the header (sticky). Click a header to sort (text or number, ascending → descending → original); sorting is a view, the file is untouched. Row numbers down the left. Ragged rows are padded. Over 200,000 cells: shows the first 200,000 with a notice. Editing happens in Source; the grid re-parses 300 ms after the last keystroke.
- **sheet (XLSX/XLS/ODS).** Read in Rust with the `calamine` crate (a new command `read_sheet(path) -> { sheets: [{ name, rows: Cell[][], truncated }] }`). Cell values are shown as Excel displays them where calamine gives the value type (numbers, dates as `dd/mm/yyyy`, booleans, errors like `#DIV/0!`); formulas show their cached result. Merged cells, colours and charts are not shown. Sheet tabs along the bottom. Same grid component as `table` (sorting, sticky header, row numbers, cell cap). File → **Save sheet as CSV…** writes the visible sheet. Password-protected or corrupt workbooks show the calamine error in the tab.
- **tree (JSON/YAML/XML).** JSON via `JSON.parse`; YAML via the `yaml` package; XML via the web view's `DOMParser`. The tree shows keys, values (strings quoted, numbers/booleans/null coloured) and item counts on objects/arrays (`{12}`, `[3]`); XML shows elements with attributes and text. Top two levels expanded; click to fold. Expand all / Collapse all buttons. A parse error shows the message and line in a banner and the tab opens in Source.
- **code (TOML/LOG/INI).** CodeMirror with a matching highlighter (TOML and INI via legacy stream modes; logs with a small highlighter colouring ERROR/FATAL red, WARN amber, INFO/DEBUG muted, timestamps dim).
- **html.** Rendered in an `<iframe sandbox>` with no `allow-scripts`, `allow-forms` or `allow-popups`, via `srcdoc`. A `<base href>` pointing at the file's folder (as an asset URL) makes relative CSS and images load. With "Block remote images" on, remote `img` / `url()` sources are removed before rendering. Links inside the page go through the same `resolveLinkTarget` (folders open in Explorer, files in tabs, web links in the browser).
- **image.** Centred, fit to the window; buttons Fit / 100% / zoom in / out and Ctrl+wheel zoom; the status bar shows pixel size and file size. SVG is shown as an `<img>` (scripts in SVG never run).
- **pdf.** The file's asset URL in an `<iframe>`: WebView2's built-in PDF viewer (scroll, zoom, find, print). The content security policy is widened to allow `frame-src` for the asset protocol only.
- **docx.** Converted to HTML with `mammoth` (headings, bold/italic, lists, tables, links, embedded images), sanitised with the existing Markdown sanitiser schema, shown with the Markdown preview styles. A banner: "Shown as formatted text: the Word layout is approximate. Open in Word to edit."

Heavy libraries (`mammoth`, `yaml`) and each viewer component load on first use, so startup is unchanged.

### Binary files

`sheet`, `image`, `pdf` and `docx` tabs are **binary**: the app doesn't decode or hold their text. For these tabs:

- they are read-only; Save / Save as are disabled (except Save sheet as CSV);
- autosave, the crash-recovery text store, encoding/line-ending detection and the unsaved-changes prompt skip them;
- the session stores only path and view state, and the tab re-reads the file from disk on restart;
- the status bar shows the file type and size instead of line/column and encoding;
- files over 50 MB show "This file is too large to preview" with **Open in default app** (a new command using `ShellExecute`).

Moving tabs between windows, groups, renaming on disk, Open in File Explorer, Close and tab colour work as for any file.

### When a file changes on disk

Text-based viewers keep today's reload behaviour. Binary tabs reload silently when they regain focus if the file's modified time changed.

### Opening these files from Windows

The installer's "Open with" registration adds these extensions (Notepad 2.0 appears in Open with; it does not become the default app). The right-click "Edit with Notepad 2.0" entry already covers every file.

## 3. Type badge at the end of the tab

In the top tab strip and the sidebar, the badge moves after the title:

- **Top tabs:** `[title…] [MD] [×]`. The title takes the free width and ellipsises; the badge never shrinks.
- **Sidebar:** the badge sits on the right of the title line, before the close button, vertically centred on the title (the last-edited time stays below the title). The title starts at the row's left edge.
- The rail is unchanged (it lists groups).

`fileBadge` gains labels for the new kinds: CSV, TSV, XLSX, XLS, ODS, JSON, YAML, XML, TOML, LOG, INI, HTML, IMG (all images), PDF, DOCX, keeping MD and TXT and the neutral style; other extensions still show their first four letters.

## Errors

Every viewer shows problems inside its tab (never a crash or a blank tab): parse errors with the line number when known, unreadable files with the OS message, and a way out (Source view, or Open in default app for binary files).

## Testing

- Unit (vitest): `resolveLinkTarget` (every row of the table above), `viewKindFor`, CSV parser (quotes, embedded newlines, delimiter detection, ragged rows), grid sort order, tree model builders for JSON/YAML/XML (including parse-error positions), log highlighter token classes, `fileBadge` labels, the session round trip for binary tabs (path only, no text), the HTML remote-image stripper.
- Rust: `path_kind` for file/dir/missing; `read_sheet` on small committed .xlsx and .ods fixtures (values, dates, a formula's cached result, two sheets).
- Browser build: the mock platform gains fixture files of each type so the Playwright screenshot script can show every viewer; screenshots go into the README and the Quickstart PDF.

## Build order

1. Type badge at the end of the tab (small, independent).
2. Folder links (`resolveLinkTarget`, `path_kind`, `open_folder`, Ctrl+click in Visual, Browse… in the link dialog).
3. View-kind plumbing: `viewKindFor`, binary tabs, generalised view switch, badges.
4. Viewers: table → tree → code → html → image → pdf → sheet (Rust) → docx.
5. Open-with registration, README / PDF updates, installer.
