import { useEffect, useState } from 'preact/hooks';
import { platform } from '../platform';
import { settings } from '../state/settings';
import { activeDoc, displayTitle, hideToTray, onWindowCloseRequested, newNote } from '../state/app';
import { AppIcon, IcMinimize, IcMaximize, IcRestore, IcClose, IcTray, IcPlus } from './icons';

export function TitleBar() {
  const [max, setMax] = useState(false);
  useEffect(() => {
    const sync = () => platform.isMaximized().then(setMax);
    sync();
    const p = platform.onResized(sync);
    return () => {
      p.then((u) => u());
    };
  }, []);

  const top = settings.value.tabsMode === 'top';
  const d = activeDoc.value;

  return (
    <header class="titlebar" data-tauri-drag-region onDblClick={(e) => (e.target as HTMLElement).hasAttribute('data-tauri-drag-region') && platform.toggleMaximize()}>
      <div class="tb-icon" data-tauri-drag-region>
        <AppIcon size={16} />
      </div>
      <div class="tb-title" data-tauri-drag-region>
        {d ? `${d.dirty ? '• ' : ''}${displayTitle(d)} - ` : ''}Notepad 2.0
        {!top && (
          <button class="tb-newtab" title="New text file (Ctrl+N)" onClick={() => newNote({ language: 'plain' })}>
            <IcPlus />
          </button>
        )}
      </div>
      <div class="tb-drag" data-tauri-drag-region />
      <div class="caption">
        <button class="cap cap-tray" title="Close to tray (Quick Note stays available)" onClick={() => hideToTray()}>
          <IcTray />
        </button>
        <button class="cap" title="Minimize" onClick={() => platform.minimize()}>
          <IcMinimize />
        </button>
        <button class="cap" title={max ? 'Restore Down' : 'Maximize'} onClick={() => platform.toggleMaximize()}>
          {max ? <IcRestore /> : <IcMaximize />}
        </button>
        <button class="cap cap-close" title={settings.value.closeToTray ? 'Close (goes to tray)' : 'Close'} onClick={() => onWindowCloseRequested()}>
          <IcClose />
        </button>
      </div>
    </header>
  );
}
