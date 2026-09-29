import { useSignalEffect } from '@preact/signals';
import { settings, isDark, systemDark } from '../state/settings';
import { ready, activeDoc, updateWindowTitle } from '../state/app';
import { settingsOpen, guideOpen } from '../state/ui';
import { Guide } from './Guide';
import { TitleBar } from './TitleBar';
import { MenuBar } from './MenuBar';
import { FormatBar } from './FormatBar';
import { TabStrip } from './TabStrip';
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
  // Offer the startup guide once, on first run.
  useSignalEffect(() => {
    if (ready.value && !settings.peek().firstRunDone && !guideOpen.peek()) setTimeout(() => (guideOpen.value = true), 600);
  });
  useSignalEffect(() => {
    activeDoc.value;
    updateWindowTitle();
  });

  const mode = settings.value.tabsMode;
  return (
    // Interface size scales only the sidebar and the document; menus and bars stay put.
    <div class={`app tabs-${mode}${ready.value ? '' : ' loading'}`} style={{ '--ui-zoom': String(settings.value.uiScale / 100) } as any}>
      <TitleBar />
      <MenuBar />
      <FormatBar />
      {mode === 'top' && <TabStrip />}
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
      {guideOpen.value && <Guide />}
    </div>
  );
}
