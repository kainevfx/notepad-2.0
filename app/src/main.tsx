import { render } from 'preact';
import 'katex/dist/katex.min.css';
import './styles/app.css';
import './styles/markdown.css';
import './styles/visual.css';
import './styles/read-aloud.css';
import { App } from './ui/App';
import { init, openFiles } from './state/app';
import { installShortcuts } from './ui/shortcuts';
import { isTauri } from './platform';

// No browser context menu or reload shortcuts in the desktop app.
if (isTauri) {
  window.addEventListener('contextmenu', (e) => {
    const t = e.target as HTMLElement;
    if (!t.closest('.cm-content, input, textarea, .markdown-body')) e.preventDefault();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F5' && e.ctrlKey) e.preventDefault();
    if (e.key === 'r' && e.ctrlKey) e.preventDefault();
  });
  // Files dropped from File Explorer open as tabs.
  import('@tauri-apps/api/webview').then(({ getCurrentWebview }) =>
    getCurrentWebview().onDragDropEvent((e) => {
      if (e.payload.type === 'drop' && e.payload.paths.length) openFiles(e.payload.paths);
    }),
  );
}

installShortcuts();
render(<App />, document.getElementById('app')!);
init();
