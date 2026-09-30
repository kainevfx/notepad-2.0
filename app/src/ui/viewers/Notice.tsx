// A message in place of a file's content (too large, unreadable, or not previewable here).
import { platform } from '../../platform';

export function Notice({ text, path, detail }: { text: string; path: string | null; detail?: string }) {
  return (
    <div class="viewer-notice">
      <p class="viewer-notice-text">{text}</p>
      {detail && <p class="viewer-notice-detail">{detail}</p>}
      {path && (
        <button class="btn" onClick={() => platform.openDefault(path).catch(() => {})}>
          Open in default app
        </button>
      )}
    </div>
  );
}
