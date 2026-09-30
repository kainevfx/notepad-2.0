# Read aloud (inherited from Codex), Markdown images, split-view minors — plan

> Kaine: "inherit the task and build it with your fullest wisdom and own plan" + fix the 7 split-view minors, then commit to GitHub. Executed inline (superpowers:executing-plans), fresh review at the end.

**Spec (decisions):**

- **Images** (user-reported: images missing in Visual and Split): keep Codex's fix — a per-editor render context (document folder + remote-image blocking) for locked blocks, an inline node view for Markdown images, `resolveImageUrl` through `resolveLinkTarget` (spaces, `[WIP]` folders, `file:` URIs, UNC), sanitiser allows `asset:`/`data:`/`blob:` image sources. Adapt to split view: each pane's Visual editor resolves against **its own** document's folder.
- **Read aloud**
  - Where: right-click in any pane (Read page aloud / Read selection aloud / Pause / Resume / Stop, plus Cut/Copy/Paste/Select all), View → Read aloud, and **Ctrl+Alt+R** (reads the selection, else the page; pressing it while reading stops).
  - What: text and Markdown (front matter, fenced code and link URLs skipped; tables read cell by cell); data files read their source; binary files are excluded.
  - Engines — Settings → Read aloud → **Voice engine**: *Automatic* (default: Kokoro when its server answers, otherwise the built-in Windows voices, with a one-line notice), *Kokoro only*, *Windows voices only*.
  - Kokoro: server URL (default `http://127.0.0.1:8880`, HTTPS required for remote hosts), voice list fetched from the server (`GET /v1/audio/voices`, falls back to a built-in list), **Test connection** button, setup help (`docker run -d --name kokoro-tts --restart unless-stopped -p 127.0.0.1:8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu`). Requests go through Rust (no CORS), audio stays in memory, 20 MB cap, WAV checked.
  - Windows voices: the web view's `speechSynthesis` (installed Windows voices), voice picker, same chunking.
  - Playback bar under the document: status, Part N of M, Pause/Resume, Stop, Speed (0.75–2×, instant), Voice & settings. Reading continues when you switch tabs or panes; it stops when the document being read is closed.
- **Split-view minors**
  1. A pane's own view override is cleared when the two sides stop showing the same document (never flips later).
  2. Drag-enter / focus inside a pane makes it active (drops are tracked).
  3. Turning split on/off keeps pane A mounted (same element tree), so its Source/Preview divider and state survive.
  4. The Settings menu-bar item works from the keyboard (click + Enter/Space).
  5. Only one Paper popover can be open (rails don't render their own when the peek sidebar shows one).
  6. Startup-guide "view switch" step falls back to the Markdown view-switch area / a centred card when absent; picks the active pane's switch in split view.
  7. Source text in a pane reserves room under the floating view switch (top padding on the first lines), so it never covers text.

**Tasks** (each: failing test → code → green suite → commit):

1. Minor 1 (lib/panes: `loadInto`/`onRemoved` clear overrides when not same) — tests in panes.test.ts.
2. Minor 3 (EditorArea keeps one element tree; pane B slot added/removed beside pane A) — test: toggling split doesn't call attachPaneView('a', null).
3. Minors 2, 4, 5, 6, 7 — tests: pane activation on dragenter/focus (panes-app), Settings menu item keyboard (render test), PaperButton single popover (render test), guide target list includes `.pane-active .view-switch`, CSS (screenshot).
4. Import Codex's work tree changes into the branch (patch + untracked files), resolve conflicts with split panes, commit "import".
5. Images per pane (render context from the pane's doc) — test extends images.test.ts to two contexts.
6. Voice engines: `speech/engines.ts` (kokoro via Rust, windows via speechSynthesis, auto = kokoro health check with cache, fallback notice) — tests with injected fakes; Rust `kokoro_voices` + `kokoro_health` commands with URL tests.
7. Commands + UI: context menu per pane, View → Read aloud, Ctrl+Alt+R toggle, playback bar (stop on close only), Settings section (engine, Kokoro URL + Test, voice lists, Windows voice, speed) — tests for command routing (selection vs page, toggle stop), stop-on-close.
8. Docs (README "Read aloud" + images), screenshots, Quickstart; full review; fix; merge into main (stash Codex's WIP in the main checkout first, tagged); build; install; push to GitHub.
