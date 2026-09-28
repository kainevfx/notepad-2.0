import { useSignalEffect } from '@preact/signals';
import { settings, isDark, systemDark } from '../state/settings';
import { ready, activeDoc, updateWindowTitle } from '../state/app';
import { settingsOpen } from '../state/ui';
import { platform } from '../platform';
import { TitleBar } from './TitleBar';
import { MenuBar } from './MenuBar';
import { Sidebar, Rail } from './Sidebar';
import { EditorPane } from './EditorPane';
import { StatusBar } from './StatusBar';
import { Settings } from './Settings';
import { ContextMenuHost } from './MenuList';
import { DialogHost, ClosedNotesDialog, Toast, DragGhost } from './Overlays';

export function App() {
  useSignalEffect(() => {
    systemDark.value;
    const dark = isDark();
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('light', !dark);
  });
  useSignalEffect(() => {
    platform.setUiScale(settings.value.uiScale / 100).catch(() => {});
  });
  useSignalEffect(() => {
    activeDoc.value;
    updateWindowTitle();
  });

  const mode = settings.value.tabsMode;
  return (
    <div class={`app tabs-${mode}${ready.value ? '' : ' loading'}`}>
      <TitleBar />
      <MenuBar />
      <div class="workspace">
        {mode === 'left' && <Sidebar />}
        {mode === 'rail' && <Rail />}
        <div class="main-col">
          <EditorPane />
          {settingsOpen.value && <Settings />}
        </div>
      </div>
      <StatusBar />
      <ContextMenuHost />
      <DialogHost />
      <ClosedNotesDialog />
      <Toast />
      <DragGhost />
    </div>
  );
}
